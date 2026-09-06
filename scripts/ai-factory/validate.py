#!/usr/bin/env python3
"""Validate the structural contracts of Neon Arsenal AI Factory artifacts.

This validator intentionally uses only Python's standard library so it can run in
CI, local hooks, or an agent sandbox without adding project dependencies.
"""

from __future__ import annotations

import re
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]

TEMPLATES = {
    "spec.md": [
        "## Status", "## Problem", "## Goal", "## Actors", "## Scope",
        "## Non-goals", "## Business Rules", "## Invariants", "## Acceptance Criteria",
        "## Verification Strategy",
    ],
    "plan.md": [
        "## Source Specification", "## Current State", "## Goal", "## Affected Areas",
        "## Implementation Sequence", "## Task Graph", "## Testing", "## Verification",
        "## Risks", "## Definition of Done",
    ],
    "task.md": [
        "## Source", "## Objective", "## Scope", "## Preconditions",
        "## Acceptance Criteria", "## Dependencies", "## Verification",
    ],
    "evaluation.md": [
        "## Execution", "## Outcome", "## Software Quality", "## Agent Execution Quality",
        "## Evidence", "## Findings", "## Learning Candidates",
    ],
    "memory.md": [
        "## Status", "## Confidence", "## Statement", "## Evidence",
        "## Affected Areas", "## Last Verified", "## Agent Guidance",
    ],
}

ID_PATTERNS = {
    "specs": re.compile(r"^SPEC-[A-Z0-9][A-Z0-9._-]*$"),
    "plans": re.compile(r"^PLAN-[A-Z0-9][A-Z0-9._-]*$"),
    "tasks": re.compile(r"^TASK-[A-Z0-9][A-Z0-9._-]*$"),
    "evaluations": re.compile(r"^EVAL-[A-Z0-9][A-Z0-9._-]*$"),
    "memory": re.compile(r"^MEM-[A-Z0-9][A-Z0-9._-]*$"),
}

errors: list[str] = []


def fail(message: str) -> None:
    errors.append(message)


def validate_templates() -> None:
    for filename, headings in TEMPLATES.items():
        path = ROOT / "docs" / "templates" / filename
        if not path.is_file():
            fail(f"missing canonical template: {path.relative_to(ROOT)}")
            continue
        content = path.read_text(encoding="utf-8")
        for heading in headings:
            if heading not in content:
                fail(f"{path.relative_to(ROOT)} missing required heading: {heading}")


def artifact_id(content: str, kind: str, path: Path) -> str | None:
    match = re.search(r"^#\s+\[([A-Z0-9][A-Z0-9._-]*)\]\s+—", content, re.MULTILINE)
    if not match:
        fail(f"{path.relative_to(ROOT)} has no canonical ID in the title")
        return None
    value = match.group(1)
    expected = ID_PATTERNS[kind]
    if not expected.match(value):
        fail(f"{path.relative_to(ROOT)} has invalid {kind[:-1]} ID: {value}")
        return None
    return value


def validate_artifacts(kind: str) -> set[str]:
    directory = ROOT / "docs" / kind
    ids: set[str] = set()
    if not directory.exists():
        return ids
    for path in sorted(directory.glob("*.md")):
        content = path.read_text(encoding="utf-8")
        value = artifact_id(content, kind, path)
        if value:
            if value in ids:
                fail(f"duplicate {kind[:-1]} ID: {value}")
            ids.add(value)
    return ids


def validate_references() -> None:
    known_specs = validate_artifacts("specs")
    known_plans = validate_artifacts("plans")
    known_tasks = validate_artifacts("tasks")
    validate_artifacts("evaluations")
    validate_artifacts("memory")

    for path in sorted((ROOT / "docs").glob("**/*.md")):
        content = path.read_text(encoding="utf-8")
        for prefix, known, label in (
            ("SPEC-", known_specs, "SPEC"),
            ("PLAN-", known_plans, "PLAN"),
            ("TASK-", known_tasks, "TASK"),
        ):
            for ref in sorted(set(re.findall(rf"{prefix}[A-Z0-9][A-Z0-9._-]*", content))):
                # Templates contain placeholders and are intentionally exempt.
                if "templates" in path.parts:
                    continue
                if ref not in known:
                    fail(f"{path.relative_to(ROOT)} references missing {label}: {ref}")


def main() -> int:
    validate_templates()
    validate_references()
    if errors:
        print("AI Factory artifact validation: FAILED")
        for error in errors:
            print(f"- {error}")
        return 1
    print("AI Factory artifact validation: PASS")
    print("- canonical templates: valid")
    print("- artifact IDs: valid")
    print("- internal references: valid")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
