#!/usr/bin/env python3
"""Validate structural contracts of Neon Arsenal AI Factory artifacts."""
from __future__ import annotations
import re
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
TEMPLATES = {
    "spec.md": ["## Status", "## Problem", "## Goal", "## Actors", "## Scope", "## Non-goals", "## Business Rules", "## Invariants", "## Acceptance Criteria", "## Verification Strategy"],
    "plan.md": ["## Source", "## Current State", "## Goal", "## Affected Areas", "## Implementation Sequence", "## Task Graph", "## Testing Strategy", "## Verification Strategy", "## Risks", "## Definition of Done"],
    "task.md": ["## Source", "## Objective", "## Scope", "## Preconditions", "## Acceptance Criteria", "## Dependencies", "## Verification Command", "## Expected Evidence"],
    "evaluation.md": ["## Execution", "## Outcome", "## Software Quality", "## Agent Execution Quality", "## Evidence", "## Findings", "## Learning Candidates"],
    "memory.md": ["## Status", "## Confidence", "## Statement", "## Evidence", "## Affected Areas", "## Last Verified", "## Agent Guidance"],
}
ID_PATTERNS = {k: re.compile(rf"^{p}-[A-Z0-9][A-Z0-9._-]*$") for k, p in {"specs":"SPEC", "plans":"PLAN", "tasks":"TASK", "evaluations":"EVAL", "memory":"MEM"}.items()}

def validate_templates(errors: list[str]) -> None:
    for filename, headings in TEMPLATES.items():
        path = ROOT / "docs" / "templates" / filename
        if not path.is_file():
            errors.append(f"missing canonical template: {path.relative_to(ROOT)}")
            continue
        content = path.read_text(encoding="utf-8")
        for heading in headings:
            if heading not in content:
                errors.append(f"{path.relative_to(ROOT)} missing required heading: {heading}")

def validate_artifacts(kind: str, errors: list[str]) -> set[str]:
    directory = ROOT / "docs" / kind
    ids: set[str] = set()
    if not directory.exists():
        return ids
    for path in sorted(directory.glob("*.md")):
        content = path.read_text(encoding="utf-8")
        match = re.search(r"^#\s+\[([A-Z0-9][A-Z0-9._-]*)\]\s+—", content, re.MULTILINE)
        if not match:
            errors.append(f"{path.relative_to(ROOT)} has no canonical ID in the title")
            continue
        value = match.group(1)
        if not ID_PATTERNS[kind].match(value):
            errors.append(f"{path.relative_to(ROOT)} has invalid {kind[:-1]} ID: {value}")
            continue
        if value in ids:
            errors.append(f"duplicate {kind[:-1]} ID: {value}")
        ids.add(value)
    return ids

def validate_references(errors: list[str]) -> None:
    known = {"SPEC-": validate_artifacts("specs", errors), "PLAN-": validate_artifacts("plans", errors), "TASK-": validate_artifacts("tasks", errors)}
    validate_artifacts("evaluations", errors)
    validate_artifacts("memory", errors)
    for path in sorted((ROOT / "docs").glob("**/*.md")):
        if "templates" in path.parts:
            continue
        content = path.read_text(encoding="utf-8")
        for prefix, ids in known.items():
            for ref in sorted(set(re.findall(rf"{prefix}[A-Z0-9][A-Z0-9._-]*", content))):
                if ref not in ids:
                    errors.append(f"{path.relative_to(ROOT)} references missing {prefix[:-1]}: {ref}")

def main() -> int:
    errors: list[str] = []
    validate_templates(errors)
    validate_references(errors)
    if errors:
        print("AI Factory artifact validation: FAILED")
        print("\n".join(f"- {e}" for e in errors))
        return 1
    print("AI Factory artifact validation: PASS")
    print("- canonical templates: valid\n- artifact IDs: valid\n- internal references: valid")
    return 0

if __name__ == "__main__":
    raise SystemExit(main())
