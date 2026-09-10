#!/usr/bin/env python3
"""Run the deterministic repository verification entrypoint used by agents and CI."""
from __future__ import annotations

import subprocess
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]

COMMANDS = (
    ("documentation contracts", [sys.executable, "scripts/docs/validate_contracts.py"]),
    ("documentation validator tests", [sys.executable, "tests/tooling/test_docs_contracts.py"]),
)


def main() -> int:
    for label, command in COMMANDS:
        print(f"==> {label}")
        result = subprocess.run(command, cwd=ROOT, check=False)
        if result.returncode != 0:
            print(f"FAILED: {label} (exit {result.returncode})", file=sys.stderr)
            return result.returncode
    print("Repository verification passed.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
