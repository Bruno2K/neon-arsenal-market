#!/usr/bin/env python3
"""Run the deterministic repository verification entrypoint used by agents and CI."""
from __future__ import annotations

import re
import subprocess
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
CANONICAL_COMMAND = "scripts/verify.py"
CANONICAL_CURSOR_RULE = ".cursor/rules/00-agent-operating-system.mdc"
RETIRED_GUIDANCE_REFERENCES = (
    "scripts/ai-factory/",
    "scripts/next.sh",
    "scripts/p-back-next.sh",
    "scripts/p-front-next.sh",
)
RETIRED_PATHS = (
    "scripts/ai-factory",
    "scripts/orchestrator",
    "scripts/p-back",
    "scripts/p-front",
    "scripts/next.sh",
    "scripts/p-back-next.sh",
    "scripts/p-front-next.sh",
)
ACTIVE_GUIDANCE_GLOBS = (
    "AGENTS.md",
    "docs/agents/*.md",
    ".cursor/rules/*.mdc",
    ".github/workflows/repository-verification.yml",
)
COMMANDS = (
    ("documentation contracts", [sys.executable, "scripts/docs/validate_contracts.py"]),
    ("documentation validator tests", [sys.executable, "tests/tooling/test_docs_contracts.py"]),
)


def fail(message: str) -> int:
    print(f"FAILED: {message}", file=sys.stderr)
    return 1


def is_executable_guidance(line: str, retired: str) -> bool:
    """Reject instructions that direct execution of a retired entrypoint, not historical mentions."""
    if retired not in line:
        return False
    normalized = line.strip().lower()
    if any(marker in normalized for marker in ("retired", "removed", "historical", "must not", "do not")):
        return False
    command_patterns = (
        r"^(?:[-*]\s*)?(?:run|execute|invoke|call|use)\b",
        r"^(?:\$\s*)?(?:python\d*|bash|sh|powershell|pwsh)\b",
        r"^(?:\$\s*)?\./",
        r"^run:\s*",
    )
    return any(re.search(pattern, normalized) for pattern in command_patterns)


def validate_entrypoint_contract() -> int:
    required = (
        ROOT / "scripts" / "docs" / "validate_contracts.py",
        ROOT / "tests" / "tooling" / "test_docs_contracts.py",
        ROOT / "docs" / "agents" / "verification.md",
        ROOT / ".github" / "workflows" / "repository-verification.yml",
        ROOT / CANONICAL_CURSOR_RULE,
    )
    missing = [path.relative_to(ROOT).as_posix() for path in required if not path.is_file()]
    if missing:
        return fail(f"missing verification surfaces: {', '.join(missing)}")

    cursor_rules = sorted((ROOT / ".cursor" / "rules").glob("*.mdc"))
    if [path.relative_to(ROOT).as_posix() for path in cursor_rules] != [CANONICAL_CURSOR_RULE]:
        return fail("Cursor adapter drift: expected exactly one canonical .mdc rule")

    reintroduced = [path for path in RETIRED_PATHS if (ROOT / path).exists()]
    if reintroduced:
        return fail(f"retired agent tooling was reintroduced: {', '.join(reintroduced)}")

    verification_doc = (ROOT / "docs" / "agents" / "verification.md").read_text(encoding="utf-8")
    workflow = (ROOT / ".github" / "workflows" / "repository-verification.yml").read_text(encoding="utf-8")
    if CANONICAL_COMMAND not in verification_doc:
        return fail("docs/agents/verification.md does not name scripts/verify.py")
    if CANONICAL_COMMAND not in workflow:
        return fail("repository verification workflow does not invoke scripts/verify.py")

    for pattern in ACTIVE_GUIDANCE_GLOBS:
        paths = [ROOT / pattern] if "*" not in pattern else sorted(ROOT.glob(pattern))
        for path in paths:
            if not path.is_file():
                continue
            for line in path.read_text(encoding="utf-8").splitlines():
                for retired in RETIRED_GUIDANCE_REFERENCES:
                    if is_executable_guidance(line, retired):
                        return fail(
                            f"active guidance {path.relative_to(ROOT)} directs execution of retired entrypoint {retired}"
                        )
    return 0


def describe_revision() -> str:
    result = subprocess.run(
        ["git", "rev-parse", "HEAD"],
        cwd=ROOT,
        capture_output=True,
        text=True,
        check=False,
    )
    return result.stdout.strip() if result.returncode == 0 else "unresolved"


def main() -> int:
    print(f"Repository verification: revision={describe_revision()} python={sys.version.split()[0]}")
    if validate_entrypoint_contract() != 0:
        return 1

    for label, command in COMMANDS:
        print(f"==> {label}")
        result = subprocess.run(command, cwd=ROOT, check=False)
        if result.returncode != 0:
            return fail(f"{label} (exit {result.returncode})")

    print("Repository verification passed.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
