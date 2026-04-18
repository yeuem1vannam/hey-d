#!/usr/bin/env bash
# Stop the brainstorm server and clean up
# Usage: stop-server.sh <session_dir> [--snapshot-on-stop]
#
# Kills the server process. Only deletes session directory if it's
# under /tmp (ephemeral). Persistent directories (tmp/brainstorm/) are
# kept so mockups can be reviewed later.
#
# Options:
#   --snapshot-on-stop   For persistent sessions, run snapshot.cjs against
#                        each content/*.html fragment before exit, producing
#                        portable <name>.snapshot.html files that render
#                        offline without the server. Ignored for /tmp sessions
#                        (they get wiped anyway).

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"

SESSION_DIR=""
SNAPSHOT_ON_STOP="false"

while [[ $# -gt 0 ]]; do
  case "$1" in
    --snapshot-on-stop)
      SNAPSHOT_ON_STOP="true"
      shift
      ;;
    *)
      if [[ -z "$SESSION_DIR" ]]; then
        SESSION_DIR="$1"
        shift
      else
        echo "{\"error\": \"Unknown argument: $1\"}"
        exit 1
      fi
      ;;
  esac
done

if [[ -z "$SESSION_DIR" ]]; then
  echo '{"error": "Usage: stop-server.sh <session_dir> [--snapshot-on-stop]"}'
  exit 1
fi

STATE_DIR="${SESSION_DIR}/state"
PID_FILE="${STATE_DIR}/server.pid"

run_snapshots() {
  # Only snapshot persistent sessions — /tmp gets deleted below.
  [[ "$SESSION_DIR" == /tmp/* ]] && return 0
  [[ "$SNAPSHOT_ON_STOP" != "true" ]] && return 0

  local plugin_root
  plugin_root="$(cd "$SCRIPT_DIR/../../.." && pwd)"
  local snapshot_script="$plugin_root/resources/visualization/snapshot.cjs"
  [[ ! -f "$snapshot_script" ]] && return 0

  # Derive project root (<project>/tmp/brainstorm/<id> → <project>) so
  # snapshot.cjs can pick up .agents/config/visualization/ overrides via cwd.
  local project_root=""
  if [[ "$SESSION_DIR" == */tmp/brainstorm/* ]]; then
    project_root="${SESSION_DIR%%/tmp/brainstorm/*}"
  fi
  [[ -z "$project_root" ]] && return 0

  local count=0
  for fragment in "$SESSION_DIR"/content/*.html; do
    [[ -f "$fragment" ]] || continue
    [[ "$fragment" == *.snapshot.html ]] && continue
    if (cd "$project_root" && node "$snapshot_script" "$fragment" >/dev/null 2>&1); then
      count=$((count + 1))
    fi
  done
  SNAPSHOT_COUNT="$count"
}

SNAPSHOT_COUNT=0

if [[ -f "$PID_FILE" ]]; then
  pid=$(cat "$PID_FILE")

  # Try to stop gracefully, fallback to force if still alive
  kill "$pid" 2>/dev/null || true

  # Wait for graceful shutdown (up to ~2s)
  for i in {1..20}; do
    if ! kill -0 "$pid" 2>/dev/null; then
      break
    fi
    sleep 0.1
  done

  # If still running, escalate to SIGKILL
  if kill -0 "$pid" 2>/dev/null; then
    kill -9 "$pid" 2>/dev/null || true

    # Give SIGKILL a moment to take effect
    sleep 0.1
  fi

  if kill -0 "$pid" 2>/dev/null; then
    echo '{"status": "failed", "error": "process still running"}'
    exit 1
  fi

  rm -f "$PID_FILE" "${STATE_DIR}/server.log"

  run_snapshots

  # Only delete ephemeral /tmp directories
  if [[ "$SESSION_DIR" == /tmp/* ]]; then
    rm -rf "$SESSION_DIR"
  fi

  if [[ "$SNAPSHOT_ON_STOP" == "true" ]]; then
    echo "{\"status\": \"stopped\", \"snapshots\": $SNAPSHOT_COUNT}"
  else
    echo '{"status": "stopped"}'
  fi
else
  echo '{"status": "not_running"}'
fi
