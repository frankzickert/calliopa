#!/usr/bin/env bash
# Converges the Garage single-node setup: layout, the backup and content
# buckets, and the access keys scoped to them. Safe to re-run: every step
# checks before it changes, and key material is re-derived from Garage rather
# than regenerated, so re-running repairs without duplicating. BO_0100_002
#
# Buckets and keys:
#   - calliopa-backups + calliopa-backup key (read/write): the backup tooling.
#   - calliopa-content + calliopa-ccgw key (read/write): CCGW's blob surface,
#     the only door consumers reach Garage through. BO_0091_008
#   - the backup key additionally gets read on the content bucket, for the
#     off-machine copy and the restore blob-integrity pass. BO_0091_009
#   - no app bucket since BO_0207_007: the graph-hosted shell keeps no object
#     store of its own; its bytes are CCGW blobs in the content bucket. An
#     app bucket a previous run converged is left as it is, for the operator
#     to drop after the transfer (BO_0207_008).
set -euo pipefail

ADMIN="http://garage:3903/v1"
SECRET_DIR="${CALLIOPA_SECRET_DIR:-/run/secrets/calliopa}"
TOKEN="$(cat "${SECRET_DIR}/garage_admin_token")"
BACKUP_BUCKET="${GARAGE_BACKUP_BUCKET:-calliopa-backups}"
BACKUP_KEY_NAME="${GARAGE_BACKUP_KEY_NAME:-calliopa-backup}"
CONTENT_BUCKET="${GARAGE_CONTENT_BUCKET:-calliopa-content}"
CONTENT_KEY_NAME="${GARAGE_CONTENT_KEY_NAME:-calliopa-ccgw}"
CAPACITY="${GARAGE_LAYOUT_CAPACITY:-10000000000}"

auth=(-H "Authorization: Bearer ${TOKEN}")

for i in $(seq 1 60); do
  if curl -fsS "${auth[@]}" "${ADMIN}/status" >/dev/null 2>&1; then
    break
  fi
  if [ "$i" = 60 ]; then
    echo "garage admin API not reachable" >&2
    exit 1
  fi
  sleep 1
done

node="$(curl -fsS "${auth[@]}" "${ADMIN}/status" | jq -r .node)"
layout="$(curl -fsS "${auth[@]}" "${ADMIN}/layout")"
layout_version="$(jq -r .version <<<"${layout}")"
role_count="$(jq -r '.roles | length' <<<"${layout}")"
staged_count="$(jq -r '.stagedRoleChanges | length' <<<"${layout}")"

if [ "${role_count}" = 0 ]; then
  if [ "${staged_count}" = 0 ]; then
    curl -fsS "${auth[@]}" -X POST "${ADMIN}/layout" \
      -d "[{\"id\":\"${node}\",\"zone\":\"dc1\",\"capacity\":${CAPACITY},\"tags\":[\"calliopa\"]}]" >/dev/null
  fi
  curl -fsS "${auth[@]}" -X POST "${ADMIN}/layout/apply" \
    -d "{\"version\":$((layout_version + 1))}" >/dev/null
  echo "garage layout applied"
else
  echo "garage layout already applied"
fi

# converge_bucket NAME -> prints the bucket id
converge_bucket() {
  local name="$1"
  if ! curl -fsS "${auth[@]}" "${ADMIN}/bucket?globalAlias=${name}" >/dev/null 2>&1; then
    curl -fsS "${auth[@]}" -X POST "${ADMIN}/bucket" -d "{\"globalAlias\":\"${name}\"}" >/dev/null
    echo "bucket ${name} created" >&2
  else
    echo "bucket ${name} already exists" >&2
  fi
  curl -fsS "${auth[@]}" "${ADMIN}/bucket?globalAlias=${name}" | jq -r .id
}

# converge_key NAME -> prints "key_id key_secret"
converge_key() {
  local name="$1" key_info
  key_info="$(curl -fsS "${auth[@]}" "${ADMIN}/key?search=${name}&showSecretKey=true" 2>/dev/null || true)"
  if [ -z "${key_info}" ] || [ "$(jq -r '.name // empty' <<<"${key_info}")" != "${name}" ]; then
    key_info="$(curl -fsS "${auth[@]}" -X POST "${ADMIN}/key" -d "{\"name\":\"${name}\"}")"
    echo "key ${name} created" >&2
  else
    echo "key ${name} already exists" >&2
  fi
  local key_id key_secret
  key_id="$(jq -r .accessKeyId <<<"${key_info}")"
  key_secret="$(jq -r .secretAccessKey <<<"${key_info}")"
  if [ -z "${key_id}" ] || [ "${key_id}" = null ] || [ -z "${key_secret}" ] || [ "${key_secret}" = null ]; then
    echo "could not obtain key material for ${name}" >&2
    exit 1
  fi
  printf '%s %s\n' "${key_id}" "${key_secret}"
}

# grant BUCKET_ID KEY_ID READ WRITE
grant() {
  curl -fsS "${auth[@]}" -X POST "${ADMIN}/bucket/allow" \
    -d "{\"bucketId\":\"$1\",\"accessKeyId\":\"$2\",\"permissions\":{\"read\":$3,\"write\":$4,\"owner\":false}}" >/dev/null
}

backup_bucket_id="$(converge_bucket "${BACKUP_BUCKET}")"
content_bucket_id="$(converge_bucket "${CONTENT_BUCKET}")"

read -r backup_key_id backup_key_secret <<<"$(converge_key "${BACKUP_KEY_NAME}")"
read -r content_key_id content_key_secret <<<"$(converge_key "${CONTENT_KEY_NAME}")"

grant "${backup_bucket_id}" "${backup_key_id}" true true
grant "${content_bucket_id}" "${content_key_id}" true true
grant "${content_bucket_id}" "${backup_key_id}" true false

umask 077
printf '%s\n' "${backup_key_id}" >"${SECRET_DIR}/garage_backup_key_id"
printf '%s\n' "${backup_key_secret}" >"${SECRET_DIR}/garage_backup_key_secret"
printf '%s\n' "${content_key_id}" >"${SECRET_DIR}/garage_content_key_id"
printf '%s\n' "${content_key_secret}" >"${SECRET_DIR}/garage_content_key_secret"
echo "backup and content key material ready"
