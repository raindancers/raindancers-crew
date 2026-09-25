#!/bin/bash
# KiroCrew snapshot-to-S3 backup, run on a schedule by a systemd timer the
# RemoteCrewInstance construct installs. Injected header (prepended at synth):
#   BACKUP_BUCKET   destination S3 bucket
#   BACKUP_PREFIX   key prefix (e.g. crew snapshots/)
#   AWS_REGION_ARG  --region <region> or empty
#
# Runs as ec2-user (the account that owns the crew home). It uses the built-in
# `kirocrew snapshot --purpose backup`, which produces a redaction-scrubbed
# bundle (the signing key, .env and execution logs never ship), then uploads
# the newest bundle to S3 with SSE-KMS (the bucket default). The bucket is
# versioned, so an upload under a stable key keeps history rather than
# clobbering it.
set -u

LOG=/var/log/kirocrew-backup.log
exec >>"$LOG" 2>&1
echo "=== kirocrew backup $(date -u) ==="

RUN_USER=ec2-user
RUN_HOME=/home/$RUN_USER
export HOME=$RUN_HOME
export PATH=$RUN_HOME/.local/bin:/usr/local/bin:/usr/bin:/bin

SNAP_DIR=$RUN_HOME/.kiro/crew/snapshots

# 1. Take a fresh snapshot (keeps the last 7 locally as a fast-restore cache).
if ! kirocrew snapshot "$SNAP_DIR" --keep 7 --purpose backup; then
  echo "ERROR: kirocrew snapshot failed"
  exit 1
fi

# 2. Find the newest bundle just written.
NEWEST=$(ls -1t "$SNAP_DIR"/*.tar 2>/dev/null | head -1)
if [ -z "$NEWEST" ]; then
  echo "ERROR: no snapshot bundle found in $SNAP_DIR"
  exit 1
fi
echo "newest bundle: $NEWEST"

# 3. Push to S3. Two copies:
#    - a timestamped key (immutable history, independent of bucket versioning)
#    - a stable 'latest.tar' key (what a replacement instance pulls to restore)
TS=$(date -u +%Y%m%dT%H%M%SZ)
BASE=$(basename "$NEWEST")
# shellcheck disable=SC2086
if ! aws s3 cp "$NEWEST" "s3://$BACKUP_BUCKET/${BACKUP_PREFIX}${TS}-${BASE}" $AWS_REGION_ARG; then
  echo "ERROR: upload of timestamped snapshot failed"
  exit 1
fi
# shellcheck disable=SC2086
if ! aws s3 cp "$NEWEST" "s3://$BACKUP_BUCKET/${BACKUP_PREFIX}latest.tar" $AWS_REGION_ARG; then
  echo "ERROR: upload of latest.tar failed"
  exit 1
fi

echo "=== backup complete: s3://$BACKUP_BUCKET/${BACKUP_PREFIX}latest.tar ($(date -u)) ==="
