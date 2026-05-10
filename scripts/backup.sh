#!/bin/sh
# Daily SQLite backup — wire into host cron:
#   docker exec sms-api /app/scripts/backup.sh
set -eu
BACKUP_DIR="${BACKUP_DIR:-/data/backups}"
DB="${DATABASE_PATH:-/data/app.db}"
mkdir -p "$BACKUP_DIR"
TS=$(date -u +%Y%m%dT%H%M%SZ)
OUT="$BACKUP_DIR/app-$TS.db"
# better-sqlite3 -- use sqlite3 .backup for a consistent snapshot
node -e "const Database=require('better-sqlite3'); const d=new Database(process.env.SRC); d.backup(process.env.OUT).then(()=>{console.log('backup ok',process.env.OUT);process.exit(0)}).catch(e=>{console.error(e);process.exit(1)});" 2>/dev/null \
  || cp "$DB" "$OUT"
# Keep last 14
ls -1t "$BACKUP_DIR"/app-*.db 2>/dev/null | tail -n +15 | xargs -r rm -f
echo "$OUT"
