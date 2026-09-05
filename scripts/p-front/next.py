#!/usr/bin/env python3
"""Deprecated shim. Intake is GitHub issues via the unified orchestrator.

Equivalent:
  python3 scripts/orchestrator/next.py --track frontend
"""

from __future__ import annotations

import runpy
import sys
from pathlib import Path

ORCH = Path(__file__).resolve().parents[1] / "orchestrator" / "next.py"


def main() -> None:
    if "--track" not in sys.argv:
        sys.argv[1:1] = ["--track", "frontend"]
    sys.argv[0] = str(ORCH)
    runpy.run_path(str(ORCH), run_name="__main__")


if __name__ == "__main__":
    main()
