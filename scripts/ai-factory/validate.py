#!/usr/bin/env python3
"""Validate structural contracts of Neon Arsenal AI Factory artifacts."""
from __future__ import annotations

import re
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]

TEMPLATES = {
    "spec.md": [
        "## Status", "## Problem", "## Goal", "## Actors", "## Scope",
        "## Non-goals", "## Business Rules", "## Invariants",
        "## State Transitions", "## API / Data Contract", "## Concurrency Model",
        "## Failure Modes", "## Security", "## Observability",
        "## Backward Compatibility", "## Acceptance Criteria",
        "## Verification Strategy", "## Decisions / References", "## Traceability",
        "## Change History",
    ],
    "plan.md": ["## Source", "## Current State", "## Goal", "## Affected Areas", "## Implementation Sequence", "## Task Graph", "## Testing Strategy", "## Verification Strategy", "## Risks", "## Definition of Done"],
    "task.md": ["## Source", "## Objective", "## Scope", "## Preconditions", "## Acceptance Criteria", "## Dependencies", "## Verification Command", "## Expected Evidence"],
    "evaluation.md": ["## Execution", "## Outcome", "## Software Quality", "## Agent Execution Quality", "## Evidence", "## Findings", "## Learning Candidates"],
    "memory.md": ["## Status", "## Confidence", "## Statement", "## Evidence", "## Affected Areas", "## Last Verified", "## Agent Guidance"],
}

ID_PATTERNS = {
    k: re.compile(rf"^{p}-[A-Z0-9][A-Z0-9._-]*$")
    for k, p in {"specs": "SPEC", "plans": "PLAN", "tasks": "TASK", "evaluations": "EVAL", "memory": "MEM"}.items()
}

FRONTMATTER_REQUIRED = ("id", "status", "version", "source_issue", "owner", "created", "updated")
VALID_SPEC_STATUSES = {"Proposed", "Accepted", "Superseded"}
GITHUB_ISSUE_REF = re.compile(r"^#[1-9][0-9]*$")


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


def parse_frontmatter(content: str) -> dict[str, str] | None:
    match = re.match(r"^---\n(.*?)\n---\n", content, re.DOTALL)
    if not match:
        return None
    values: dict[str, str] = {}
    for line in match.group(1).splitlines():
        key, separator, value = line.partition(":")
        if separator:
            values[key.strip()] = value.strip().strip('"')
    return values


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

        if kind == "specs":
            validate_spec(path, content, value, errors)

    return ids


def validate_spec(path: Path, content: str, title_id: str, errors: list[str]) -> None:
    frontmatter = parse_frontmatter(content)
    relative = path.relative_to(ROOT)
    if frontmatter is None:
        errors.append(f"{relative} has no YAML frontmatter")
        return

    for field in FRONTMATTER_REQUIRED:
        if not frontmatter.get(field):
            errors.append(f"{relative} missing required frontmatter field: {field}")

    if frontmatter.get("id") and frontmatter["id"] != title_id:
        errors.append(f"{relative} frontmatter id {frontmatter['id']} does not match title ID {title_id}")

    status = frontmatter.get("status")
    if status and status not in VALID_SPEC_STATUSES:
        errors.append(f"{relative} has invalid Specification status: {status}")

    if frontmatter.get("version") and not frontmatter["version"].isdigit():
        errors.append(f"{relative} has non-numeric Specification version: {frontmatter['version']}")

    source_issue = frontmatter.get("source_issue")
    if source_issue and not GITHUB_ISSUE_REF.fullmatch(source_issue):
        errors.append(f"{relative} has invalid source_issue; expected canonical GitHub Issue reference #<number>: {source_issue}")

    if re.search(r"^\s*- \[ \] `AC-[^`]+`.*\*\*Evidence:\*\*\s*(?:test|static check|integration|runtime|manual review)\s*$", content, re.MULTILINE) is None:
        errors.append(f"{relative} must contain at least one unchecked acceptance criterion with an Evidence class")

    if "GitHub Issue → SPEC → PLAN → TASK(S) → PR → VERIFICATION/CONVERGENCE → EVALUATION → MEMORY" not in content:
        errors.append(f"{relative} is missing the canonical traceability chain")


def validate_references(errors: list[str]) -> None:
    known = {
        "SPEC-": validate_artifacts("specs", errors),
        "PLAN-": validate_artifacts("plans", errors),
        "TASK-": validate_artifacts("tasks", errors),
    }
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
    print("- canonical templates: valid\n- artifact IDs: valid\n- specification contracts: valid\n- internal references: valid")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
