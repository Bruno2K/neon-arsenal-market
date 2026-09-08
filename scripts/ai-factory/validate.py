#!/usr/bin/env python3
"""Validate structural contracts of Neon Arsenal AI Factory artifacts."""
from __future__ import annotations

import re
import subprocess
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
    "plan.md": [
        "## Status", "## Source", "## Current State", "## Goal",
        "## Affected Areas", "## Architecture", "## Database",
        "## Implementation Sequence", "## Task Graph", "## Testing Strategy",
        "## Verification Strategy", "## Risks", "## Dependencies",
        "## Stop Conditions", "## Definition of Done", "## Traceability",
        "## Change History",
    ],
    "task.md": [
        "## Status", "## Source", "## Objective", "## Scope",
        "## Allowed Files", "## Preconditions", "## Acceptance Criteria",
        "## Dependencies", "## Risks", "## Verification Command",
        "## Expected Evidence", "## Stop Conditions", "## Traceability",
        "## Change History",
    ],
    "evaluation.md": ["## Execution", "## Outcome", "## Software Quality", "## Agent Execution Quality", "## Evidence", "## Findings", "## Learning Candidates"],
    "memory.md": ["## Status", "## Confidence", "## Statement", "## Evidence", "## Affected Areas", "## Last Verified", "## Agent Guidance"],
}

ID_PATTERNS = {
    k: re.compile(rf"^{p}-[A-Z0-9][A-Z0-9._-]*$")
    for k, p in {"specs": "SPEC", "plans": "PLAN", "tasks": "TASK", "evaluations": "EVAL", "memory": "MEM"}.items()
}
ID_PATTERNS["plans"] = re.compile(r"^PLAN-[A-Z0-9](?:[A-Z0-9._-]*[A-Z0-9])?$")
ID_PATTERNS["tasks"] = re.compile(r"^TASK-[A-Z0-9](?:[A-Z0-9._-]*[A-Z0-9])?$")

FRONTMATTER_REQUIRED = ("id", "status", "version", "source_issue", "owner", "created", "updated")
VALID_SPEC_STATUSES = {"Proposed", "Accepted", "Superseded"}
PLAN_FRONTMATTER_REQUIRED = (
    "id", "status", "version", "source_spec", "source_spec_version",
    "baseline_revision", "owner", "created", "updated",
)
VALID_PLAN_STATUSES = {"Draft", "Ready", "Superseded"}
TASK_FRONTMATTER_REQUIRED = (
    "id", "status", "version", "source_issue", "source_spec",
    "source_spec_version", "source_plan", "source_plan_version",
    "baseline_revision", "owner", "created", "updated",
)
VALID_TASK_STATUSES = {"Blocked", "Ready", "InProgress", "Done", "Superseded"}
GITHUB_ISSUE_REF = re.compile(r"^#[1-9][0-9]*$")
SPEC_REF = re.compile(r"^SPEC-[A-Z0-9](?:[A-Z0-9._-]*[A-Z0-9])?$")
PLAN_REF = re.compile(r"^PLAN-[A-Z0-9](?:[A-Z0-9._-]*[A-Z0-9])?$")
GIT_COMMIT = re.compile(r"^[0-9a-f]{40}$")
TRACEABILITY_CHAIN = "GitHub Issue → SPEC → PLAN → TASK(S) → PR → VERIFICATION/CONVERGENCE → EVALUATION → MEMORY"


def has_markdown_heading(content: str, heading: str) -> bool:
    """Match an exact Markdown heading line outside fenced code blocks."""
    in_fence = False
    fence_marker = ""
    for line in content.splitlines():
        stripped = line.strip()
        if stripped.startswith(("```", "~~~")):
            marker = stripped[:3]
            if not in_fence:
                in_fence = True
                fence_marker = marker
            elif marker == fence_marker:
                in_fence = False
                fence_marker = ""
            continue
        if not in_fence and line.rstrip() == heading:
            return True
    return False


def validate_templates(errors: list[str]) -> None:
    for filename, headings in TEMPLATES.items():
        path = ROOT / "docs" / "templates" / filename
        if not path.is_file():
            errors.append(f"missing canonical template: {path.relative_to(ROOT)}")
            continue
        content = path.read_text(encoding="utf-8")
        for heading in headings:
            if not has_markdown_heading(content, heading):
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
        elif kind == "plans":
            validate_plan(path, content, value, errors)
        elif kind == "tasks":
            validate_task(path, content, value, errors)

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

    if TRACEABILITY_CHAIN not in content:
        errors.append(f"{relative} is missing the canonical traceability chain")


def validate_plan(path: Path, content: str, title_id: str, errors: list[str]) -> None:
    frontmatter = parse_frontmatter(content)
    try:
        relative: Path | str = path.relative_to(ROOT)
    except ValueError:
        relative = path
    if frontmatter is None:
        errors.append(f"{relative} has no YAML frontmatter")
        return

    for field in PLAN_FRONTMATTER_REQUIRED:
        if not frontmatter.get(field):
            errors.append(f"{relative} missing required Plan frontmatter field: {field}")

    if frontmatter.get("id") and frontmatter["id"] != title_id:
        errors.append(f"{relative} frontmatter id {frontmatter['id']} does not match title ID {title_id}")

    status = frontmatter.get("status")
    if status and status not in VALID_PLAN_STATUSES:
        errors.append(f"{relative} has invalid Plan status: {status}")

    for field in ("version", "source_spec_version"):
        if frontmatter.get(field) and not frontmatter[field].isdigit():
            errors.append(f"{relative} has non-numeric Plan {field}: {frontmatter[field]}")

    source_spec = frontmatter.get("source_spec")
    if source_spec and not SPEC_REF.fullmatch(source_spec):
        errors.append(f"{relative} has invalid source_spec: {source_spec}")

    baseline_revision = frontmatter.get("baseline_revision")
    if baseline_revision:
        validate_baseline_revision(relative, baseline_revision, errors)

    for heading in TEMPLATES["plan.md"]:
        if not has_markdown_heading(content, heading):
            errors.append(f"{relative} missing required Plan heading: {heading}")

    if TRACEABILITY_CHAIN not in content:
        errors.append(f"{relative} is missing the canonical traceability chain")

    if status != "Ready" or not source_spec or not frontmatter.get("source_spec_version"):
        return

    source_metadata = None
    for spec_path in sorted((ROOT / "docs" / "specs").glob("*.md")):
        candidate = parse_frontmatter(spec_path.read_text(encoding="utf-8"))
        if candidate and candidate.get("id") == source_spec:
            source_metadata = candidate
            break
    if source_metadata is None:
        return  # Cross-reference validation reports the missing Specification.
    if source_metadata.get("status") != "Accepted":
        errors.append(f"{relative} is Ready but source Specification {source_spec} is not Accepted")
    if source_metadata.get("version") != frontmatter["source_spec_version"]:
        errors.append(
            f"{relative} source_spec_version {frontmatter['source_spec_version']} does not match "
            f"{source_spec} version {source_metadata.get('version', '<missing>')}"
        )


def validate_baseline_revision(relative: Path | str, revision: str, errors: list[str]) -> None:
    if not GIT_COMMIT.fullmatch(revision):
        errors.append(f"{relative} has invalid baseline_revision; expected a 40-character Git commit")
        return

    result = subprocess.run(
        [
            "git", "-c", f"safe.directory={ROOT.resolve().as_posix()}",
            "cat-file", "-e", f"{revision}^{{commit}}",
        ],
        cwd=ROOT,
        capture_output=True,
        text=True,
        encoding="utf-8",
        errors="replace",
        check=False,
    )
    if result.returncode == 0:
        return

    detail = result.stderr.strip().splitlines()[-1] if result.stderr.strip() else "unknown Git error"
    missing_object = any(
        marker in result.stderr.lower()
        for marker in ("not a valid object", "bad object", "unknown revision")
    )
    if missing_object:
        errors.append(f"{relative} baseline_revision does not resolve to a repository commit: {revision}")
    else:
        errors.append(f"{relative} could not verify baseline_revision with Git: {detail}")


def find_artifact_metadata(kind: str, artifact_id: str) -> dict[str, str] | None:
    for artifact_path in sorted((ROOT / "docs" / kind).glob("*.md")):
        candidate = parse_frontmatter(artifact_path.read_text(encoding="utf-8"))
        if candidate and candidate.get("id") == artifact_id:
            return candidate
    return None


def markdown_section(content: str, heading: str) -> str:
    match = re.search(
        rf"^{re.escape(heading)}\s*$\n(.*?)(?=^##\s|\Z)",
        content,
        re.MULTILINE | re.DOTALL,
    )
    return match.group(1).strip() if match else ""


def validate_task(path: Path, content: str, title_id: str, errors: list[str]) -> None:
    try:
        relative: Path | str = path.relative_to(ROOT)
    except ValueError:
        relative = path
    frontmatter = parse_frontmatter(content)
    if frontmatter is None:
        errors.append(f"{relative} has no YAML frontmatter")
        return

    for field in TASK_FRONTMATTER_REQUIRED:
        if not frontmatter.get(field):
            errors.append(f"{relative} missing required Task frontmatter field: {field}")

    if frontmatter.get("id") and frontmatter["id"] != title_id:
        errors.append(f"{relative} frontmatter id {frontmatter['id']} does not match title ID {title_id}")

    status = frontmatter.get("status")
    if status and status not in VALID_TASK_STATUSES:
        errors.append(f"{relative} has invalid Task status: {status}")

    for field in ("version", "source_spec_version", "source_plan_version"):
        if frontmatter.get(field) and not frontmatter[field].isdigit():
            errors.append(f"{relative} has non-numeric Task {field}: {frontmatter[field]}")

    source_issue = frontmatter.get("source_issue")
    if source_issue and not GITHUB_ISSUE_REF.fullmatch(source_issue):
        errors.append(f"{relative} has invalid source_issue; expected canonical GitHub Issue reference #<number>: {source_issue}")

    source_spec = frontmatter.get("source_spec")
    if source_spec and not SPEC_REF.fullmatch(source_spec):
        errors.append(f"{relative} has invalid source_spec: {source_spec}")

    source_plan = frontmatter.get("source_plan")
    if source_plan and not PLAN_REF.fullmatch(source_plan):
        errors.append(f"{relative} has invalid source_plan: {source_plan}")

    baseline_revision = frontmatter.get("baseline_revision")
    if baseline_revision:
        validate_baseline_revision(relative, baseline_revision, errors)

    for heading in TEMPLATES["task.md"]:
        if not has_markdown_heading(content, heading):
            errors.append(f"{relative} missing required Task heading: {heading}")

    if TRACEABILITY_CHAIN not in content:
        errors.append(f"{relative} is missing the canonical traceability chain")

    acceptance_section = markdown_section(content, "## Acceptance Criteria")
    acceptance_pattern = r"^\s*- \[[ xX]\] `AC-[^`]+`.*\*\*Evidence:\*\*\s*(?:test|static check|integration|runtime|manual review)\s*$"
    if re.search(acceptance_pattern, acceptance_section, re.MULTILINE) is None:
        errors.append(f"{relative} must contain at least one acceptance criterion with an Evidence class")

    command_section = markdown_section(content, "## Verification Command")
    command_match = re.search(r"```(?:bash|sh|powershell)?\s*\n(.+?)\n```", command_section, re.DOTALL)
    if command_match is None or command_match.group(1).strip() in {"", "..."}:
        errors.append(f"{relative} must contain an exact fenced verification command")

    if status == "Done" and re.search(r"^\s*- \[ \] `AC-", acceptance_section, re.MULTILINE):
        errors.append(f"{relative} is Done but has unchecked acceptance criteria")

    if not source_plan or not frontmatter.get("source_plan_version"):
        return
    plan_metadata = find_artifact_metadata("plans", source_plan)
    if plan_metadata is None:
        return  # Cross-reference validation reports the missing Plan.
    if plan_metadata.get("version") != frontmatter["source_plan_version"]:
        errors.append(
            f"{relative} source_plan_version {frontmatter['source_plan_version']} does not match "
            f"{source_plan} version {plan_metadata.get('version', '<missing>')}"
        )
    if source_spec and plan_metadata.get("source_spec") != source_spec:
        errors.append(f"{relative} source_spec {source_spec} does not match {source_plan} source Specification")
    if frontmatter.get("source_spec_version") and plan_metadata.get("source_spec_version") != frontmatter["source_spec_version"]:
        errors.append(
            f"{relative} source_spec_version {frontmatter['source_spec_version']} does not match "
            f"{source_plan} source Specification version {plan_metadata.get('source_spec_version', '<missing>')}"
        )
    if status in {"Ready", "InProgress", "Done"} and plan_metadata.get("status") != "Ready":
        errors.append(f"{relative} is {status} but source Plan {source_plan} is not Ready")


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
            for ref in artifact_references(content, prefix):
                if ref not in ids:
                    errors.append(f"{path.relative_to(ROOT)} references missing {prefix[:-1]}: {ref}")


def artifact_references(content: str, prefix: str) -> list[str]:
    """Extract canonical-looking references without swallowing path/punctuation suffixes."""
    raw = re.findall(rf"{prefix}[A-Z0-9][A-Z0-9._-]*", content)
    return sorted({value.rstrip("._-") for value in raw})


def main() -> int:
    errors: list[str] = []
    validate_templates(errors)
    validate_references(errors)
    if errors:
        print("AI Factory artifact validation: FAILED")
        print("\n".join(f"- {e}" for e in errors))
        return 1

    print("AI Factory artifact validation: PASS")
    print("- canonical templates: valid\n- artifact IDs: valid\n- specification contracts: valid\n- plan contracts: valid\n- task contracts: valid\n- internal references: valid")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
