#!/bin/bash
# Restore a KiroCrew crew on a REPLACEMENT instance from an S3 snapshot backup.
# Installed at /usr/local/sbin/kirocrew-restore-from-s3 by RemoteCrewInstance
# when a backup bucket is configured. Injected header (prepended at synth):
#   BACKUP_BUCKET   source S3 bucket
#   BACKUP_PREFIX   key prefix
#   AWS_REGION_ARG  --region <region> or empty
#
# Usage:  kirocrew-restore-from-s3            # restore the latest snapshot
#         kirocrew-restore-from-s3 <s3-key>   # restore a specific key
#
# Uses --mode replace: this is meant for a FRESH crew whose empty stores are
# cleared and rebuilt as the snapshot. It is NOT for merging into a crew whose
# current state you want to keep (use `kirocrew restore <file> --mode merge`
# by hand for that). Restore refuses while the gateway runs, so it is stopped
# first and restarted after.
set -eu

# Load the backup destination the construct baked in at install time.
if [ -f /etc/kirocrew/backup.env ]; then
  # shellcheck disable=SC1091
  . /etc/kirocrew/backup.env
fi
: "${BACKUP_BUCKET:?BACKUP_BUCKET not set (missing /etc/kirocrew/backup.env)}"
: "${BACKUP_PREFIX:=crew-snapshots/}"
: "${AWS_REGION_ARG:=}"

RUN_USER=ec2-user
RUN_HOME=/home/$RUN_USER
export HOME=$RUN_HOME
export PATH=$RUN_HOME/.local/bin:/usr/local/bin:/usr/bin:/bin

KEY="${1:-${BACKUP_PREFIX}latest.tar}"
DEST=/tmp/kirocrew-restore.tar

echo "pulling s3://$BACKUP_BUCKET/$KEY"
# shellcheck disable=SC2086
aws s3 cp "s3://$BACKUP_BUCKET/$KEY" "$DEST" $AWS_REGION_ARG

echo "stopping the gateway before restore"
systemctl stop kirocrew.service 2>/dev/null || true

echo "restoring (mode=replace) as $RUN_USER"
sudo -u "$RUN_USER" env HOME="$RUN_HOME" PATH="$PATH" \
  kirocrew restore "$DEST" --mode replace --force

echo "restarting the gateway"
systemctl start kirocrew.service

rm -f "$DEST"
echo "restore complete from s3://$BACKUP_BUCKET/$KEY"
