#!/usr/bin/env bash
# The Calliopa host-side updater. install.sh leaves it running as a user
# service. It watches one directory, updater/ beside this checkout's
# docker-compose.yml, which the kernel container sees as its updater
# directory, and it does exactly what the README's update path did by hand —
# git fetch, git checkout, ./install.sh — on a request the kernel wrote for
# the owner, and nothing else. It never accepts, promotes or touches the graph.
#
# The directory carries two files (docs/system/ui-kernel.md, BO_0223_004):
#   request.json  — written by the kernel for the owner: version, requestedBy,
#                   requestedAt. Taken (removed) here the moment a run starts,
#                   so a restart of either side cannot run a request twice.
#   status.json   — written here every 10 s: state (idle, running, failed),
#                   heartbeat, since, and while running or after a failure the
#                   version, the step (fetch, checkout, install), the last 50
#                   log lines and the exit line. The kernel reads it on every
#                   call and reports the updater absent when the heartbeat is
#                   older than 60 s.
set -u

checkout="$(cd "$(dirname "${BASH_SOURCE[0]:-$0}")/.." && pwd)"
dir="$checkout/updater"
status_file="$dir/status.json"
request_file="$dir/request.json"
log_file="$dir/log"
self="$checkout/scripts/calliopa-updater.sh"
heartbeat_seconds=10
log_lines=50

mkdir -p "$dir"
cd "$checkout" || exit 1

# One updater per checkout: a second one started by hand leaves quietly.
pid_file="$dir/updater.pid"
if [ -f "$pid_file" ] && kill -0 "$(cat "$pid_file" 2>/dev/null)" 2>/dev/null && [ "$(cat "$pid_file")" != "$$" ]; then
  echo "another updater is running for $checkout (pid $(cat "$pid_file")); leaving" >&2
  exit 0
fi
printf '%s\n' "$$" > "$pid_file"

now() { date -u +%Y-%m-%dT%H:%M:%SZ; }
mtime() { stat -c %Y "$1" 2>/dev/null || stat -f %m "$1" 2>/dev/null || echo 0; }
json_escape() {
  # One line in, one JSON string body out: backslash, quote, tab, CR.
  printf '%s' "$1" | sed -e 's/\\/\\\\/g' -e 's/"/\\"/g' -e 's/\t/\\t/g' -e 's/\r//g'
}

state=idle
since="$(now)"
version=""
step=""
exit_line=""

write_status() {
  local tmp="$status_file.tmp" first=1 line
  {
    printf '{\n  "state": "%s",\n  "heartbeat": "%s",\n  "since": "%s"' "$state" "$(now)" "$since"
    [ -n "$version" ] && printf ',\n  "version": "%s"' "$(json_escape "$version")"
    [ -n "$step" ] && printf ',\n  "step": "%s"' "$step"
    [ -n "$exit_line" ] && printf ',\n  "exit": "%s"' "$(json_escape "$exit_line")"
    if [ -s "$log_file" ]; then
      printf ',\n  "log": ['
      while IFS= read -r line || [ -n "$line" ]; do
        [ "$first" = 1 ] || printf ','
        first=0
        printf '\n    "%s"' "$(json_escape "$line")"
      done < <(tail -n "$log_lines" "$log_file")
      printf '\n  ]'
    fi
    printf '\n}\n'
  } > "$tmp" && mv -f "$tmp" "$status_file"
}

# Runs one step with its output in the log, keeping the heartbeat alive while
# it runs; answers the step's exit code.
run_step() {
  step="$1"; shift
  printf '== %s: %s\n' "$step" "$*" >> "$log_file"
  write_status
  "$@" >> "$log_file" 2>&1 &
  local pid=$!
  while kill -0 "$pid" 2>/dev/null; do
    write_status
    sleep "$heartbeat_seconds"
  done
  wait "$pid"
}

fail() {
  state=failed
  exit_line="$1"
  step=""
  printf '%s\n' "$exit_line" >> "$log_file"
  write_status
}

take_request() {
  local raw requested_by
  raw="$(cat "$request_file" 2>/dev/null)" || return 1
  rm -f "$request_file"
  version="$(printf '%s' "$raw" | tr -d '\n' | sed -n 's/.*"version"[[:space:]]*:[[:space:]]*"\([^"]*\)".*/\1/p')"
  requested_by="$(printf '%s' "$raw" | tr -d '\n' | sed -n 's/.*"requestedBy"[[:space:]]*:[[:space:]]*"\([^"]*\)".*/\1/p')"
  : > "$log_file"
  exit_line=""
  since="$(now)"
  state=running
  printf 'update to %s requested by %s at %s\n' "$version" "${requested_by:-?}" "$since" >> "$log_file"
  write_status
  if ! printf '%s' "$version" | grep -Eq '^[0-9]+\.[0-9]+\.[0-9]+$'; then
    fail "refused: the version must be <major>.<minor>.<patch>, got '$version'"
    return 0
  fi
  local before_install
  before_install="$(mtime "$self")"
  local rc
  run_step fetch git fetch --tags --force; rc=$?
  if [ "$rc" -ne 0 ]; then
    fail "fetch exited with $rc: $(tail -n 1 "$log_file")"
    return 0
  fi
  run_step checkout git checkout --detach "v$version"; rc=$?
  if [ "$rc" -ne 0 ]; then
    fail "checkout of v$version exited with $rc: $(tail -n 1 "$log_file")"
    return 0
  fi
  CALLIOPA_UPDATER=1 run_step install ./install.sh; rc=$?
  if [ "$rc" -ne 0 ]; then
    fail "install exited with $rc: $(tail -n 1 "$log_file")"
    return 0
  fi
  printf 'update to %s installed at %s; review and promote it in Calliopa\n' "$version" "$(now)" >> "$log_file"
  state=idle
  step=""
  since="$(now)"
  write_status
  # A release can ship a new updater: run it from now on.
  if [ "$(mtime "$self")" != "$before_install" ]; then
    printf 'updater replaced by the release; restarting it\n' >> "$log_file"
    write_status
    exec "$self"
  fi
}

trap 'rm -f "$pid_file"; exit 0' INT TERM
write_status
while :; do
  if [ -f "$request_file" ]; then
    take_request
  fi
  write_status
  sleep "$heartbeat_seconds"
done
