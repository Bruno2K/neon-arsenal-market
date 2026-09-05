#!/usr/bin/env bash
set -euo pipefail
exec python3 "$(dirname "$0")/p-front/next.py" "$@"
