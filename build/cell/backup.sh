#!/usr/bin/env bash
# Backup tooling for the bootstrap stack. One tool, several verbs, so the
# scheduled job, the restore path, the drill, and the off-machine copy all
# exercise the same code. BO_0100_003 BO_0100_004 BO_0100_005 BO_0100_006
#
#   backup run      scheduled loop: dump + upload + retention, forever
#   backup once     one dump + upload + retention pass — the graph and the
#                   memory service's database, each under its own prefix
#                   (BO_0200_006, BO_0207_010)
#   backup dump DBNAME
#                   one dump of a named database under its own prefix, outside
#                   the schedule: the final dump of a database about to be
#                   dropped, which then stays listed as archived (BO_0207_010)
#   backup list     list backups in the bucket: the databases the stack owns,
#                   then every archived prefix a dump was once taken under
#   backup restore [NAME|latest] [DBNAME] [SOURCE]
#                   restore a backup of SOURCE (default: the graph database;
#                   the memory service's or an archived one by name) into
#                   DBNAME (default: SOURCE itself; stop the consumers first
#                   when restoring a live one)
#   backup drill [SOURCE]
#                   restore latest of SOURCE (default: the graph) into a
#                   scratch database, sanity-check, verify blob integrity for
#                   the graph, drop
#   backup offsite  sync the backup bucket, then the content bucket, to the
#                   operator-configured RCLONE_CONFIG_OFFSITE_* remote
set -euo pipefail

SECRET_DIR="${CALLIOPA_SECRET_DIR:-/run/secrets/calliopa}"
PGHOST="${POSTGRES_HOST:-postgres}"
PGPORT="${POSTGRES_PORT:-5432}"
PGUSER="${POSTGRES_USER:-calliopa}"
PGDATABASE="${POSTGRES_DB:-calliopa}"
# Every database the stack owns: the graph and the memory service's. Each
# dumps under its own prefix, so a restore names its source. The shell's own
# database is retired (BO_0207_010); its final dump stays under
# postgres/calliopa_app/ as an archived database. BO_0200_006
MEMORY_DATABASE="${CALLIOPA_MEMORY_DB:-honcho}"
DATABASES="${PGDATABASE} ${MEMORY_DATABASE}"
BUCKET="${GARAGE_BACKUP_BUCKET:-calliopa-backups}"
CONTENT_BUCKET="${GARAGE_CONTENT_BUCKET:-calliopa-content}"
PREFIX="postgres"

# prefix_for DBNAME -> the bucket prefix holding that database's dumps. The
# graph keeps the original prefix, so dumps taken before BO_0200 stay listed.
prefix_for() {
  if [ "$1" = "${PGDATABASE}" ]; then
    printf '%s' "${PREFIX}"
  else
    printf '%s/%s' "${PREFIX}" "$1"
  fi
}
INTERVAL="${BACKUP_INTERVAL_SECONDS:-86400}"
RETENTION_DAYS="${BACKUP_RETENTION_DAYS:-14}"

export PGPASSWORD PGHOST PGPORT PGUSER
PGPASSWORD="$(cat "${SECRET_DIR}/postgres_password")"

# rclone remote "garage:" from the scoped backup key the init one-shot wrote.
export RCLONE_CONFIG_GARAGE_TYPE=s3
export RCLONE_CONFIG_GARAGE_PROVIDER=Other
export RCLONE_CONFIG_GARAGE_ENDPOINT="${GARAGE_S3_ENDPOINT:-http://garage:3900}"
export RCLONE_CONFIG_GARAGE_REGION="${GARAGE_S3_REGION:-garage}"
export RCLONE_CONFIG_GARAGE_ACCESS_KEY_ID RCLONE_CONFIG_GARAGE_SECRET_ACCESS_KEY
RCLONE_CONFIG_GARAGE_ACCESS_KEY_ID="$(cat "${SECRET_DIR}/garage_backup_key_id")"
RCLONE_CONFIG_GARAGE_SECRET_ACCESS_KEY="$(cat "${SECRET_DIR}/garage_backup_key_secret")"

# dump_one DBNAME -> one consistent dump uploaded under the database's prefix.
dump_one() {
  local db="$1" ts name local_file remote size_local size_remote
  ts="$(date -u +%Y%m%dT%H%M%SZ)"
  name="${db}-${ts}.dump"
  local_file="/tmp/${name}"
  remote="garage:${BUCKET}/$(prefix_for "${db}")/${name}"

  # pg_dump runs in a single snapshot, which is what makes this a consistent
  # point-in-time backup of a live database. BO_0100_003
  pg_dump -d "${db}" -Fc -Z 6 -f "${local_file}"
  rclone copyto "${local_file}" "${remote}"
  size_local="$(stat -c %s "${local_file}")"
  size_remote="$(rclone lsjson "${remote}" | jq -r '.[0].Size')"
  if [ "${size_local}" != "${size_remote}" ]; then
    echo "upload size mismatch for ${name}: local ${size_local}, remote ${size_remote}" >&2
    rm -f "${local_file}"
    return 1
  fi
  rm -f "${local_file}"
  echo "backup ${name} uploaded (${size_local} bytes)"
}

backup_once() {
  local db rc=0
  for db in ${DATABASES}; do
    # A database the instance has not created yet (the memory profile never
    # started) is skipped, not failed; the graph is never skipped.
    if [ "${db}" != "${PGDATABASE}" ] && ! psql -d postgres -tA -c "SELECT 1 FROM pg_database WHERE datname = '${db}'" | grep -q 1; then
      echo "database ${db} does not exist; skipped"
      continue
    fi
    dump_one "${db}" || rc=1
  done
  for db in ${DATABASES}; do
    rclone delete "garage:${BUCKET}/$(prefix_for "${db}")" --min-age "${RETENTION_DAYS}d" 2>/dev/null || true
  done
  echo "retention pass done (kept <= ${RETENTION_DAYS} days)"
  return "${rc}"
}

# latest_name SOURCE -> the newest dump file of that database
latest_name() {
  rclone lsjson "garage:${BUCKET}/$(prefix_for "$1")" --files-only | jq -r 'sort_by(.ModTime) | last | .Name // empty'
}

# fetch_backup NAME SOURCE
fetch_backup() {
  local name="$1" source="$2" local_file="/tmp/$1"
  rclone copyto "garage:${BUCKET}/$(prefix_for "${source}")/${name}" "${local_file}"
  echo "${local_file}"
}

# restore_into NAME DBNAME SOURCE
restore_into() {
  local name="$1" dbname="$2" source="${3:-${PGDATABASE}}" local_file
  local_file="$(fetch_backup "${name}" "${source}")"
  psql -d postgres -v ON_ERROR_STOP=1 \
    -c "DROP DATABASE IF EXISTS \"${dbname}\" WITH (FORCE)" \
    -c "CREATE DATABASE \"${dbname}\" OWNER \"${PGUSER}\""
  pg_restore -d "${dbname}" --no-owner --role "${PGUSER}" "${local_file}"
  rm -f "${local_file}"
  echo "restored ${name} into database ${dbname}"
}

# The restore blob-integrity pass: every hash the restored graph references —
# read from the blob_reference record, never scanned out of revision content —
# must resolve to an object in the content bucket. A dump predating the record
# has no blob references and passes vacuously. BO_0091_009
blob_integrity_pass() {
  local dbname="$1" referenced existing missing
  referenced="$(psql -d "${dbname}" -tA -v ON_ERROR_STOP=1 \
    -c "SELECT DISTINCT replace(hash, 'sha256:', '') FROM blob_reference" 2>/dev/null || true)"
  if [ -z "${referenced}" ]; then
    echo "blob integrity ok: no blob references in ${dbname}"
    return 0
  fi
  existing="$(rclone lsf "garage:${CONTENT_BUCKET}/sha256" 2>/dev/null || true)"
  missing="$(comm -23 <(printf '%s\n' "${referenced}" | sort) <(printf '%s\n' "${existing}" | sort))"
  if [ -n "${missing}" ]; then
    echo "blob integrity FAILED: referenced blobs missing from ${CONTENT_BUCKET}:" >&2
    printf '%s\n' "${missing}" >&2
    return 1
  fi
  echo "blob integrity ok: every referenced hash resolves in ${CONTENT_BUCKET} ($(printf '%s\n' "${referenced}" | wc -l) hash(es))"
}

cmd="${1:-run}"
case "${cmd}" in
run)
  echo "scheduled backups every ${INTERVAL}s, retention ${RETENTION_DAYS}d"
  while true; do
    backup_once || echo "backup failed; retrying at next interval" >&2
    sleep "${INTERVAL}"
  done
  ;;
once)
  backup_once
  ;;
dump)
  # An explicit dump outside the schedule. Any database the server holds may
  # be named; a database the schedule no longer covers lands under its own
  # prefix and is listed as archived from then on. BO_0207_010
  db="${2:?backup dump needs a database name}"
  if ! psql -d postgres -tA -c "SELECT 1 FROM pg_database WHERE datname = '${db}'" | grep -q 1; then
    echo "database ${db} does not exist" >&2
    exit 1
  fi
  dump_one "${db}"
  ;;
list)
  for db in ${DATABASES}; do
    echo "== ${db} (garage:${BUCKET}/$(prefix_for "${db}"))"
    rclone lsjson "garage:${BUCKET}/$(prefix_for "${db}")" --files-only 2>/dev/null \
      | jq -r '.[] | "\(.Size)\t\(.ModTime)\t\(.Name)"' || true
  done
  # Archived databases: a prefix a dump was once taken under that the schedule
  # no longer covers — the shell's store after BO_0207. Restorable by name into
  # a scratch database; never dumped again. BO_0207_010
  for dir in $(rclone lsjson "garage:${BUCKET}/${PREFIX}" --dirs-only 2>/dev/null | jq -r '.[].Name'); do
    case " ${DATABASES} " in *" ${dir} "*) continue ;; esac
    echo "== ${dir} (archived; garage:${BUCKET}/${PREFIX}/${dir})"
    rclone lsjson "garage:${BUCKET}/${PREFIX}/${dir}" --files-only 2>/dev/null \
      | jq -r '.[] | "\(.Size)\t\(.ModTime)\t\(.Name)"' || true
  done
  ;;
restore)
  name="${2:-latest}"
  source="${4:-${PGDATABASE}}"
  if [ "${name}" = latest ]; then
    name="$(latest_name "${source}")"
  fi
  if [ -z "${name}" ]; then
    echo "no backup of ${source} found in garage:${BUCKET}/$(prefix_for "${source}")" >&2
    exit 1
  fi
  restore_into "${name}" "${3:-${source}}" "${source}"
  ;;
drill)
  # Routine proof that the latest backup restores to a working database,
  # without touching the live one. The graph by default; the shell's or the
  # memory service's by name. BO_0100_005 BO_0200_006
  source="${2:-${PGDATABASE}}"
  name="$(latest_name "${source}")"
  if [ -z "${name}" ]; then
    echo "no backup of ${source} found in garage:${BUCKET}/$(prefix_for "${source}")" >&2
    exit 1
  fi
  drill_db="${source}_drill"
  restore_into "${name}" "${drill_db}" "${source}"
  if [ "${source}" = "${PGDATABASE}" ]; then
    revisions="$(psql -d "${drill_db}" -tA -v ON_ERROR_STOP=1 -c 'SELECT count(*) FROM node_revision')"
    integrity_rc=0
    blob_integrity_pass "${drill_db}" || integrity_rc=1
  else
    revisions="$(psql -d "${drill_db}" -tA -v ON_ERROR_STOP=1 -c "SELECT count(*) FROM information_schema.tables WHERE table_schema = 'public'")"
    integrity_rc=0
  fi
  psql -d postgres -v ON_ERROR_STOP=1 -c "DROP DATABASE \"${drill_db}\" WITH (FORCE)"
  if [ "${integrity_rc}" != 0 ]; then
    exit 1
  fi
  if [ "${source}" = "${PGDATABASE}" ]; then
    echo "drill ok: ${name} restored, node_revision count ${revisions}"
  else
    echo "drill ok: ${name} restored, ${revisions} table(s)"
  fi
  ;;
offsite)
  # The operator supplies the offsite remote as RCLONE_CONFIG_OFFSITE_* in
  # .env; nothing about the destination is baked in here. BO_0100_006
  if [ -z "${RCLONE_CONFIG_OFFSITE_TYPE:-}" ]; then
    echo "no offsite remote configured: set RCLONE_CONFIG_OFFSITE_* in .env" >&2
    exit 1
  fi
  # Backup bucket first, content bucket after: every graph snapshot in the
  # backup bucket was taken before this content sync ran, blobs are immutable,
  # and referenced blobs are GC-exempt, so the content copy necessarily covers
  # every reference in every copied snapshot — the graph-first ordering that
  # keeps an off-machine restore blob-complete. BO_0091_009
  rclone sync "garage:${BUCKET}" "offsite:${OFFSITE_PATH:-calliopa-backups}"
  rclone sync "garage:${CONTENT_BUCKET}" "offsite:${OFFSITE_CONTENT_PATH:-calliopa-content}"
  echo "offsite copy done (backups, then content)"
  ;;
*)
  echo "unknown command ${cmd}" >&2
  exit 1
  ;;
esac
