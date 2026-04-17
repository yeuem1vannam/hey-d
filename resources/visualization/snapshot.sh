#!/usr/bin/env bash
# Thin wrapper around snapshot.js for convenience.
exec node "$(dirname "$0")/snapshot.cjs" "$@"
