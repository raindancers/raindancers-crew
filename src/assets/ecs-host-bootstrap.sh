#!/bin/bash
# KiroCrew ECS-on-EC2 host bootstrap (cloud-init, first boot, root).
#
# This host runs the ECS agent (the AMI is ECS-optimized Amazon Linux 2023, so
# the agent is preinstalled) and does the NAT for the crew tasks, which run in
# awsvpc mode on their own private ENIs. It joins the cluster, enables IP
# forwarding + an iptables MASQUERADE rule, and mounts each per-crew durable
# EBS volume resolved by a STABLE FILESYSTEM LABEL (never /dev/sdf, which the
# Nitro NVMe layer renames unpredictably).
#
# The header the EcsCrewHost construct prepends defines, before this body runs:
#   ECS_CLUSTER         name of the cluster to register with
#   CREW_COUNT          number of crews (informational)
#   CREW_VOLUME_LABELS  space-separated filesystem labels, one per crew volume
#   CREW_MOUNT_PATHS    space-separated host mount paths, positionally matched
#                       to CREW_VOLUME_LABELS
#
# Security-load-bearing choices preserved from the EC2 bootstrap: IMDSv2 is
# enforced at the instance (construct side), and the bootstrap is resumable
# across a first-boot reboot via a systemd oneshot.
set -u

BOOTSTRAP_SCRIPT=/usr/local/sbin/kirocrew-ecs-host-bootstrap
BOOTSTRAP_STATE=/var/lib/kirocrew-ecs-host-bootstrap
SETUP_DONE=$BOOTSTRAP_STATE/setup-complete

# cloud-init runs UserData once. Persist the rendered script and hand off to a
# systemd oneshot so a managed patch reboot can resume it on boot.
if [ "$#" -eq 0 ]; then
  install -m 0700 "$0" "$BOOTSTRAP_SCRIPT"
  cat > /etc/systemd/system/kirocrew-ecs-host-bootstrap.service <<'UNIT'
[Unit]
Description=Kiro Crew ECS-host resumable bootstrap
After=network-online.target
Wants=network-online.target

[Service]
Type=oneshot
ExecStart=/usr/local/sbin/kirocrew-ecs-host-bootstrap --resume
RemainAfterExit=yes

[Install]
WantedBy=multi-user.target
UNIT
  systemctl daemon-reload
  systemctl enable kirocrew-ecs-host-bootstrap.service
  systemctl start --no-block kirocrew-ecs-host-bootstrap.service
  exit 0
fi

mkdir -p "$BOOTSTRAP_STATE"
[ -f "$SETUP_DONE" ] && exit 0
exec >>/var/log/kirocrew-ecs-host-setup.log 2>&1
echo "=== KiroCrew ECS-host bootstrap starting $(date -u) ==="

# --- 1. Per-crew durable EBS: resolve by LABEL, format on first use only,
# mount, and persist in fstab keyed by LABEL so a Nitro NVMe rename cannot
# mount the wrong crew's state.
echo "--- mounting per-crew data volumes (resolve-by-label) ---"
# Positional pairing of labels and mount paths.
read -r -a LABELS <<< "${CREW_VOLUME_LABELS:-}"
read -r -a MOUNTS <<< "${CREW_MOUNT_PATHS:-}"
i=0
while [ "$i" -lt "${#LABELS[@]}" ]; do
  label="${LABELS[$i]}"
  mount_path="${MOUNTS[$i]}"
  i=$((i + 1))
  [ -n "$label" ] || continue
  [ -n "$mount_path" ] || continue
  mkdir -p "$mount_path"

  # Wait for the raw device to attach. On Nitro the device is /dev/nvmeXn1;
  # match it by the EBS volume mapping rather than a guessed name. We find any
  # unmounted, unformatted-or-labelled block device and label it on first use.
  dev=""
  for _ in $(seq 1 30); do
    # A volume already carrying our label (instance replacement / reboot).
    existing=$(blkid -L "$label" 2>/dev/null || true)
    if [ -n "$existing" ]; then
      dev="$existing"
      break
    fi
    # Otherwise pick a data disk that is not the root device and has no fs yet.
    while read -r cand; do
      [ -n "$cand" ] || continue
      # Skip the root device and any partition/child.
      root_src=$(findmnt -n -o SOURCE / 2>/dev/null | sed 's/[0-9]*p\?[0-9]*$//')
      case "/dev/$cand" in
        "$root_src"*) continue ;;
      esac
      # Skip anything already carrying a filesystem or mounted.
      if [ -z "$(blkid "/dev/$cand" 2>/dev/null)" ] && ! findmnt -S "/dev/$cand" >/dev/null 2>&1; then
        dev="/dev/$cand"
        break
      fi
    done < <(lsblk -dn -o NAME 2>/dev/null)
    [ -n "$dev" ] && break
    sleep 5
  done

  if [ -z "$dev" ]; then
    echo "WARNING: could not resolve a device for crew volume label '$label'; skipping"
    continue
  fi

  # Format only if the device has no filesystem yet (first provision). An
  # already-labelled device (reattached) is never reformatted.
  if [ -z "$(blkid "$dev" 2>/dev/null)" ]; then
    echo "formatting $dev as ext4 with label '$label' (first provision)"
    mkfs.ext4 -F -L "$label" "$dev" || { echo "WARNING: mkfs failed for $dev"; continue; }
  fi

  # Persist by LABEL (stable), not by device name (renamed on Nitro).
  if ! grep -q "LABEL=$label " /etc/fstab; then
    echo "LABEL=$label $mount_path ext4 defaults,nofail 0 2" >> /etc/fstab
  fi
  mount "$mount_path" 2>/dev/null || mount -L "$label" "$mount_path" || \
    echo "WARNING: could not mount label '$label' at $mount_path"
  echo "crew volume '$label' -> $mount_path"
done

# --- 2. Host NAT for the crew task ENIs: enable IP forwarding and MASQUERADE
# egress out of the primary interface. The construct disables source/dest check
# on the host ENI so the kernel may forward packets not addressed to the host.
echo "--- enabling host NAT (ip_forward + iptables MASQUERADE) ---"
cat > /etc/sysctl.d/99-kirocrew-nat.conf <<'SYSCTL'
net.ipv4.ip_forward = 1
SYSCTL
sysctl --system >/dev/null 2>&1 || sysctl -w net.ipv4.ip_forward=1 || true

# Resolve the primary egress interface (the one carrying the default route).
EGRESS_IF=$(ip route show default 2>/dev/null | awk '/default/ {print $5; exit}')
[ -n "$EGRESS_IF" ] || EGRESS_IF=$(ls /sys/class/net | grep -E '^(eth0|ens|enp)' | head -1)
echo "egress interface: ${EGRESS_IF:-unknown}"

if [ -n "$EGRESS_IF" ]; then
  # Idempotent: only add the MASQUERADE rule if it is not already present.
  if ! iptables -t nat -C POSTROUTING -o "$EGRESS_IF" -j MASQUERADE 2>/dev/null; then
    iptables -t nat -A POSTROUTING -o "$EGRESS_IF" -j MASQUERADE || true
  fi
  # Persist the rules across reboot. iptables-services provides the save path;
  # fall back to a boot-time restore unit if the package is unavailable.
  if command -v iptables-save >/dev/null 2>&1; then
    mkdir -p /etc/kirocrew
    iptables-save > /etc/kirocrew/nat.rules || true
    cat > /etc/systemd/system/kirocrew-nat-restore.service <<'UNIT'
[Unit]
Description=Restore KiroCrew host NAT iptables rules
After=network-online.target
Wants=network-online.target
Before=ecs.service

[Service]
Type=oneshot
ExecStart=/bin/sh -c '/sbin/iptables-restore < /etc/kirocrew/nat.rules'
RemainAfterExit=yes

[Install]
WantedBy=multi-user.target
UNIT
    systemctl daemon-reload
    systemctl enable kirocrew-nat-restore.service || true
  fi
fi

# --- 2b. Disable source/dest check on THIS instance so the kernel forwards
# packets not addressed to the host (the ENI-level half of NAT; ip_forward is
# the kernel half). CloudFormation cannot set this on an ASG-launched instance,
# so the host does it to itself via IMDSv2 identity + modify-instance-attribute
# (the host role is scoped to KiroCrew ECS hosts by a tag condition).
echo "--- disabling source/dest check on the host ENI ---"
TOKEN=$(curl -s -X PUT "http://169.254.169.254/latest/api/token" \
  -H "X-aws-ec2-metadata-token-ttl-seconds: 300" 2>/dev/null || true)
IID=$(curl -s -H "X-aws-ec2-metadata-token: $TOKEN" \
  http://169.254.169.254/latest/meta-data/instance-id 2>/dev/null || true)
AZ=$(curl -s -H "X-aws-ec2-metadata-token: $TOKEN" \
  http://169.254.169.254/latest/meta-data/placement/availability-zone 2>/dev/null || true)
REGION="${AZ%[a-z]}"
if [ -n "$IID" ] && [ -n "$REGION" ]; then
  aws ec2 modify-instance-attribute --no-source-dest-check \
    --instance-id "$IID" --region "$REGION" \
    || echo "WARNING: could not disable source/dest check (NAT forwarding may drop task egress)"
else
  echo "WARNING: could not resolve instance-id/region from IMDS; source/dest check left unchanged"
fi

# --- 3. Join the ECS cluster: write /etc/ecs/ecs.config with the cluster name
# and enable awsvpc task networking (ENI trunking raises the per-instance task
# ENI budget on smaller sizes). The ECS agent (preinstalled on the ECS AMI)
# reads this on start.
echo "--- joining ECS cluster '$ECS_CLUSTER' ---"
mkdir -p /etc/ecs
# Append only the keys we own; do not clobber an AMI-provided config.
{
  echo "ECS_CLUSTER=$ECS_CLUSTER"
  echo "ECS_ENABLE_TASK_ENI=true"
  echo "ECS_AWSVPC_BLOCK_IMDS=true"
  echo "ECS_ENABLE_AWSVPC_TRUNKING=true"
} >> /etc/ecs/ecs.config

# Start (or restart) the agent so it picks up the config.
systemctl enable --now ecs.service 2>/dev/null || systemctl restart ecs 2>/dev/null || true

echo "=== KiroCrew ECS-host bootstrap complete $(date -u) ==="
touch "$SETUP_DONE"
