#!/bin/bash
# KiroCrew EC2 bootstrap (cloud-init, first boot, root).
#
# Ported faithfully from the upstream kirocrew-ec2.yaml UserData
# (github.com/kirodotdev/KiroCrew, src/kiro_crew/cloud/templates). The upstream
# CloudFormation !Sub placeholders are replaced by a small header that the
# RemoteCrewInstance construct prepends at synth time, so this file carries NO
# CloudFormation-specific syntax and can be linted/diffed as a plain script.
#
# The header the construct prepends defines, before this body runs:
#   WAIT_HANDLE     signed WaitCondition URL (cfn-signal target)
#   DASHBOARD_PORT  gateway port
#   SOURCE_BUCKET   S3 source bucket (empty => git clone)
#   SOURCE_KEY      S3 source key
#   KIROCREW_REPO   git repo to clone
#   KIROCREW_REF    git ref to install
#   WEBHOOK_TOKEN_SECRET_ARN  (optional) Secrets Manager ARN of the native-
#                   webhook Bearer token; when non-empty it is fetched at boot
#                   and written to config.json as hooks.webhook_token. Empty =>
#                   webhook auth unconfigured (loopback/SSM only), unchanged.
#   CREW_AUTOPILOT  (optional) "1" => set agent.approval_mode="auto" in
#                   config.json. Empty => gateway default (interactive).
#   CREW_DISABLE_IDLE_CLOSE  (optional) "1" => set session.timeout_secs=0
#                   (disables the idle session sweep). Empty => default 3600s.
#
# Security-load-bearing choices preserved from upstream: IMDSv2 is enforced at
# the instance (construct side), the Node tarball SHA-256 is verified before
# root extraction, the dashboard SPA build is a FATAL gate, and the bootstrap
# is resumable across a first-boot reboot.
set -u

BOOTSTRAP_SCRIPT=/usr/local/sbin/kirocrew-bootstrap
BOOTSTRAP_STATE=/var/lib/kirocrew-bootstrap
INSTALL_DONE=$BOOTSTRAP_STATE/install-complete
SIGNAL_DONE=$BOOTSTRAP_STATE/signal-complete

# cloud-init runs UserData once. Persist the rendered script and hand off to a
# systemd oneshot so a managed patch reboot can resume it on boot.
if [ "$#" -eq 0 ]; then
  install -m 0700 "$0" "$BOOTSTRAP_SCRIPT"
  cat > /etc/systemd/system/kirocrew-bootstrap.service <<'UNIT'
[Unit]
Description=Kiro Crew resumable bootstrap
After=network-online.target
Wants=network-online.target

[Service]
Type=oneshot
ExecStart=/usr/local/sbin/kirocrew-bootstrap --resume
RemainAfterExit=yes

[Install]
WantedBy=multi-user.target
UNIT
  systemctl daemon-reload
  systemctl enable kirocrew-bootstrap.service
  systemctl start --no-block kirocrew-bootstrap.service
  exit 0
fi

mkdir -p "$BOOTSTRAP_STATE"
[ -f "$SIGNAL_DONE" ] && exit 0
exec >>/var/log/kirocrew-setup.log 2>&1
echo "=== KiroCrew bootstrap starting $(date -u) ==="

HANDLE="$WAIT_HANDLE"
LOG=/var/log/kirocrew-setup.log

# Fold the log tail into a FAILURE reason so a rollback carries the real cause.
fail() {
  err1=$(grep -aiE 'error|fail|cannot|denied|refused|curl: \(' "$LOG" 2>/dev/null \
    | grep -av 'BOOTSTRAP FAILED' | tail -1 | tr -d '\r"\\' | tr -cd '\40-\176' | tail -c 200)
  echo "BOOTSTRAP FAILED: $1"
  tail_ctx=$(tail -n 25 "$LOG" 2>/dev/null | tr -d '\r"\\' \
    | grep -aviE 'Installing (npm|kirocrew and) depend|building React app' \
    | tr '\n' '|' | tr -cd '\40-\176' | tail -c 900)
  reason="$(printf '%s' "$1" | tr -d '"\\' | tr '\n' '|' | tr -cd '\40-\176') :: $err1 :: ...$tail_ctx"
  /opt/aws/bin/cfn-signal -e 1 -r "$(echo "$reason" | head -c 1000)" "$HANDLE" || \
    curl -s -X PUT -H 'Content-Type:' --data-binary \
      "{\"Status\":\"FAILURE\",\"Reason\":\"$(echo "$reason" | head -c 1000)\",\"UniqueId\":\"kirocrew\",\"Data\":\"fail\"}" "$HANDLE" || true
  exit 1
}

if [ ! -f "$INSTALL_DONE" ]; then
  systemctl stop kirocrew.service 2>/dev/null || true

  echo "--- suppressing AL2023 first-boot SELinux reboot ---"
  rm -f /run/cloud-init-selinux-reboot 2>/dev/null || true
  rm -f /etc/cloud/cloud.cfg.d/40_selinux-reboot.cfg 2>/dev/null || true
  shutdown -c 2>/dev/null || true

  RUN_USER=ec2-user
  RUN_HOME=/home/$RUN_USER

  echo "--- provisioning swap (headroom for the vite build) ---"
  if [ ! -e /swapfile ] && [ "$(free -m | awk '/^Swap:/ {print $2}')" = "0" ]; then
    ( fallocate -l 4G /swapfile || dd if=/dev/zero of=/swapfile bs=1M count=4096 ) 2>/dev/null \
      && chmod 600 /swapfile && mkswap /swapfile >/dev/null 2>&1 && swapon /swapfile \
      && echo '/swapfile none swap sw 0 0' >> /etc/fstab \
      && echo "swap on: $(free -m | awk '/^Swap:/ {print $2}') MB" \
      || echo "swap provisioning skipped (non-fatal)"
  else
    echo "swap already present or /swapfile exists - skipping"
  fi

  echo "--- installing system packages ---"
  dnf install -y git tmux python3 python3-pip unzip tar gzip which \
    || fail "essential package install failed (git/python3/unzip)"
  dnf install -y python3.12 python3.12-pip \
    || echo "python3.12 unavailable from dnf; install.sh will provision one"
  dnf install -y ripgrep || echo "ripgrep unavailable (optional), continuing"

  echo "--- installing Node.js ---"
  NODE_MAJOR_MIN=22
  command -v node >/dev/null 2>&1 || dnf install -y nodejs npm || true
  NODE_MAJOR=$(node --version 2>/dev/null | sed -n 's/^v\([0-9][0-9]*\).*/\1/p' | head -1)
  [ -n "$NODE_MAJOR" ] || NODE_MAJOR=0
  if [ "$NODE_MAJOR" -lt "$NODE_MAJOR_MIN" ]; then
    NODE_V=v22.12.0
    case "$(uname -m)" in
      aarch64) NODE_ARCH=linux-arm64; NODE_SHA=9e7905fdee722f9650a03ae644b51c4c6effd3b98ac93c588700072ab35c9ddb ;;
      x86_64) NODE_ARCH=linux-x64; NODE_SHA=e05a4d65232ae2b27b3d77da2e368522fb46b923335b8e0d5f77624c32484044 ;;
      *) fail "unsupported arch for Node install: $(uname -m)" ;;
    esac
    NODE_TARB=node-$NODE_V-$NODE_ARCH
    echo "installing Node $NODE_V ($NODE_ARCH) from the official nodejs.org tarball"
    curl --proto '=https' --tlsv1.2 -fsSL "https://nodejs.org/dist/$NODE_V/$NODE_TARB.tar.gz" -o /tmp/node.tar.gz || fail "Node download failed"
    # TLS protects transport, not the artifact: verify the PINNED SHA-256
    # before extracting as root. Fails closed on any mismatch.
    echo "$NODE_SHA  /tmp/node.tar.gz" | sha256sum -c - || fail "Node tarball checksum mismatch (possible tampering)"
    tar -xzf /tmp/node.tar.gz -C /usr/local || fail "Node extract failed"
    ln -sf /usr/local/$NODE_TARB/bin/node /usr/local/bin/node
    ln -sf /usr/local/$NODE_TARB/bin/npm /usr/local/bin/npm
    ln -sf /usr/local/$NODE_TARB/bin/npx /usr/local/bin/npx
    hash -r 2>/dev/null || true
    NODE_MAJOR=$(node --version 2>/dev/null | sed -n 's/^v\([0-9][0-9]*\).*/\1/p' | head -1)
    [ -n "$NODE_MAJOR" ] || NODE_MAJOR=0
  fi
  [ "$NODE_MAJOR" -ge "$NODE_MAJOR_MIN" ] || fail "Node.js too old (major $NODE_MAJOR, need >=$NODE_MAJOR_MIN)"
  echo "node: $(command -v node) $(node --version 2>/dev/null || echo missing)"
  echo "npm:  $(command -v npm) $(npm --version 2>/dev/null || echo missing)"

  echo "--- installing kiro-cli ---"
  # AL2023 glibc 2.34 is too old for the standard build: musl required.
  ARCH=$(uname -m)
  if [ "$ARCH" = "aarch64" ]; then
    KIRO_URL="https://desktop-release.q.us-east-1.amazonaws.com/latest/kirocli-aarch64-linux-musl.zip"
  else
    KIRO_URL="https://desktop-release.q.us-east-1.amazonaws.com/latest/kirocli-x86_64-linux-musl.zip"
  fi
  sudo -u $RUN_USER bash -lc "cd \$HOME; curl --proto '=https' --tlsv1.2 -sSf '$KIRO_URL' -o kirocli.zip" \
    || fail "could not DOWNLOAD kiro-cli from $KIRO_URL (host unresolvable/unreachable here)"
  sudo -u $RUN_USER bash -lc "
    set -e
    cd \$HOME
    unzip -o -q kirocli.zip
    ./kirocli/install.sh --no-confirm || yes | ./kirocli/install.sh || true
  " || echo 'kiro-cli install returned nonzero (verifying the binary below)'
  sudo -u $RUN_USER bash -lc 'command -v kiro-cli >/dev/null 2>&1 || [ -x "$HOME/.local/bin/kiro-cli" ] || [ -x /usr/local/bin/kiro-cli ]' \
    || fail "kiro-cli did not install (the chat backend would not work)"

  echo "--- fetching + installing KiroCrew ---"
  cat > /tmp/kcfetch.sh <<KCFETCH
#!/bin/bash
set -e
# sudo resets PATH to secure_path; prepend /usr/local/bin so the build sees Node 22.
export PATH="/usr/local/bin:\$PATH"
cd "$RUN_HOME"
rm -rf kirocrew && mkdir kirocrew
if [ -n "$SOURCE_BUCKET" ]; then
  echo "downloading source from s3://$SOURCE_BUCKET/$SOURCE_KEY"
  aws s3 cp "s3://$SOURCE_BUCKET/$SOURCE_KEY" /tmp/kirocrew-src.tar.gz
  tar -xzf /tmp/kirocrew-src.tar.gz -C kirocrew
else
  echo "cloning $KIROCREW_REPO@$KIROCREW_REF"
  rm -rf kirocrew
  # '--' ends option parsing so the URL can't read as a git flag.
  git clone --depth 1 --branch "$KIROCREW_REF" -- "$KIROCREW_REPO" kirocrew
fi
cd kirocrew
export KIROCREW_REQUIRE_FRONTEND=1
if ! bash install.sh --voice; then
  echo "install.sh failed on first attempt - settling then retrying once"
  sleep 20
  bash install.sh --voice
fi
KCFETCH
  chmod +x /tmp/kcfetch.sh
  chown $RUN_USER /tmp/kcfetch.sh
  sudo -u $RUN_USER bash /tmp/kcfetch.sh || fail "kirocrew source fetch or install failed"

  echo "--- verifying the dashboard SPA was actually built ---"
  DIST_INDEX="$RUN_HOME/kirocrew/src/kiro_crew/static/dist/index.html"
  if [ ! -f "$DIST_INDEX" ]; then
    fe_err="$(grep -aiE 'npm error|npm ERR|error TS[0-9]|vite|Killed|Cannot find module|ENOSPC|no space left|out of memory|FATAL ERROR|Skipping frontend build' "$LOG" 2>/dev/null | tr -d '\r"\\' | tail -n 12 | tr '\n' '|' | tail -c 500)"
    [ -n "$fe_err" ] || fe_err="<none captured; check /var/log/kirocrew-setup.log on the instance>"
    fail "dashboard frontend build missing (no static/dist). Build errors: $fe_err"
  fi

  echo "--- installing the systemd service ---"
  sudo -u $RUN_USER bash -lc "
    export PATH=\$HOME/.local/bin:\$PATH
    kirocrew setup --agent-only || true
  " || true

  # --- Native-webhook Bearer token (RC3, guarded). When a Secrets Manager ARN
  # was passed, fetch the token and write it into the crew config.json as
  # hooks.webhook_token so POST /api/hooks/agent authenticates. The token is
  # fetched at boot, never baked into userData/code. The gateway still binds
  # loopback only; routable exposure is a consumer reverse-proxy/tunnel concern.
  if [ -n "${WEBHOOK_TOKEN_SECRET_ARN:-}" ]; then
    echo "--- configuring native-webhook token from Secrets Manager ---"
    WEBHOOK_TOKEN=$(aws secretsmanager get-secret-value \
      --secret-id "$WEBHOOK_TOKEN_SECRET_ARN" \
      --query SecretString --output text 2>/dev/null) \
      || fail "could not fetch the webhook token secret ($WEBHOOK_TOKEN_SECRET_ARN)"
    if [ -z "$WEBHOOK_TOKEN" ]; then
      fail "webhook token secret resolved empty ($WEBHOOK_TOKEN_SECRET_ARN)"
    fi
    CONFIG_DIR="$RUN_HOME/.kiro/crew"
    CONFIG_JSON="$CONFIG_DIR/config.json"
    sudo -u $RUN_USER mkdir -p "$CONFIG_DIR"
    # Merge hooks.webhook_token into config.json without clobbering other keys.
    # python3 is installed above; write the token via env, never on argv.
    WEBHOOK_TOKEN="$WEBHOOK_TOKEN" CONFIG_JSON="$CONFIG_JSON" \
      sudo -u $RUN_USER -E python3 - <<'PYEOF' \
      || fail "could not write hooks.webhook_token into config.json"
import json, os
path = os.environ["CONFIG_JSON"]
token = os.environ["WEBHOOK_TOKEN"]
try:
    with open(path) as f:
        cfg = json.load(f)
    if not isinstance(cfg, dict):
        cfg = {}
except (FileNotFoundError, ValueError):
    cfg = {}
hooks = cfg.get("hooks")
if not isinstance(hooks, dict):
    hooks = {}
hooks["webhook_token"] = token
cfg["hooks"] = hooks
with open(path, "w") as f:
    json.dump(cfg, f, indent=2)
PYEOF
    chown "$RUN_USER":"$RUN_USER" "$CONFIG_JSON" 2>/dev/null || true
    chmod 600 "$CONFIG_JSON" 2>/dev/null || true
    unset WEBHOOK_TOKEN
    echo "webhook token written to config.json (hooks.webhook_token)"
  fi

  # --- Always-on crew runtime (RC4, guarded). Merge autopilot / no-idle-close
  # into config.json. Empty flags => keys untouched => current gateway defaults.
  if [ -n "${CREW_AUTOPILOT:-}" ] || [ -n "${CREW_DISABLE_IDLE_CLOSE:-}" ]; then
    echo "--- configuring always-on crew runtime (autopilot/idle-close) ---"
    CONFIG_DIR="$RUN_HOME/.kiro/crew"
    CONFIG_JSON="$CONFIG_DIR/config.json"
    sudo -u $RUN_USER mkdir -p "$CONFIG_DIR"
    CREW_AUTOPILOT="${CREW_AUTOPILOT:-}" \
    CREW_DISABLE_IDLE_CLOSE="${CREW_DISABLE_IDLE_CLOSE:-}" \
    CONFIG_JSON="$CONFIG_JSON" \
      sudo -u $RUN_USER -E python3 - <<'PYEOF' \
      || fail "could not write crew runtime settings into config.json"
import json, os
path = os.environ["CONFIG_JSON"]
try:
    with open(path) as f:
        cfg = json.load(f)
    if not isinstance(cfg, dict):
        cfg = {}
except (FileNotFoundError, ValueError):
    cfg = {}
if os.environ.get("CREW_AUTOPILOT"):
    agent = cfg.get("agent")
    if not isinstance(agent, dict):
        agent = {}
    agent["approval_mode"] = "auto"
    cfg["agent"] = agent
if os.environ.get("CREW_DISABLE_IDLE_CLOSE"):
    session = cfg.get("session")
    if not isinstance(session, dict):
        session = {}
    session["timeout_secs"] = 0
    cfg["session"] = session
with open(path, "w") as f:
    json.dump(cfg, f, indent=2)
PYEOF
    chown "$RUN_USER":"$RUN_USER" "$CONFIG_JSON" 2>/dev/null || true
    echo "crew runtime settings written to config.json"
  fi

  KIROCREW_BIN=$(sudo -u $RUN_USER bash -lc 'command -v kirocrew || echo $HOME/.local/bin/kirocrew')
  cat > /etc/systemd/system/kirocrew.service <<UNIT
[Unit]
Description=KiroCrew AI Agent Gateway
After=network-online.target
Wants=network-online.target

[Service]
Type=simple
User=$RUN_USER
ExecStart=$KIROCREW_BIN gateway
Restart=on-failure
RestartSec=10
WorkingDirectory=$RUN_HOME
Environment=HOME=$RUN_HOME
Environment=PATH=$RUN_HOME/.local/bin:/usr/local/bin:/usr/bin:/bin
Environment=KIROCREW_PORT=$DASHBOARD_PORT

[Install]
WantedBy=multi-user.target
UNIT
  systemctl daemon-reload
  touch "$INSTALL_DONE"
fi

# Safe to repeat after install completed but before the WaitCondition ack was recorded.
systemctl enable kirocrew.service || fail "could not enable kirocrew.service"
systemctl start kirocrew.service || fail "could not start kirocrew.service"

echo "--- waiting for the gateway to answer on 127.0.0.1:$DASHBOARD_PORT ---"
ok=0
for i in $(seq 1 60); do
  if curl -fsS -o /dev/null http://127.0.0.1:$DASHBOARD_PORT/ 2>/dev/null; then ok=1; break; fi
  sleep 5
done
[ "$ok" = "1" ] || fail "gateway did not become healthy within 5 minutes"

echo "=== KiroCrew bootstrap complete $(date -u) ==="
signal_ok=0
for attempt in 1 2 3; do
  if /opt/aws/bin/cfn-signal -e 0 -r "kirocrew healthy" "$HANDLE"; then signal_ok=1; break; fi
  if curl -fsS -X PUT -H 'Content-Type:' --data-binary \
    "{\"Status\":\"SUCCESS\",\"Reason\":\"kirocrew healthy\",\"UniqueId\":\"kirocrew\",\"Data\":\"ok\"}" "$HANDLE"; then signal_ok=1; break; fi
  echo "WaitCondition success signal attempt $attempt failed; retrying"
  sleep 5
done
[ "$signal_ok" = "1" ] || { echo "could not deliver WaitCondition success"; exit 1; }
touch "$SIGNAL_DONE"
