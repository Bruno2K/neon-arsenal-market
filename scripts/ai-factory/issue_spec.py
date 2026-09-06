#!/usr/bin/env python3
"""Issue ↔ Specification traceability primitives for the AI Factory."""
from __future__ import annotations

import re
from pathlib import Path

ISSUE_REF_RE = re.compile(r"^#([1-9][0-9]*)$")
SPEC_REF_RE = re.compile(r"^SPEC-[A-Z0-9][A-Z0-9._-]*$")


def canonical_issue_ref(value: str) -> str:
    """Return a canonical GitHub Issue reference or raise ValueError."""
    value = value.strip()
    if not ISSUE_REF_RE.fullmatch(value):
        raise ValueError(f"invalid GitHub Issue reference: {value!r}")
    return value


def extract_source_issue(frontmatter: dict[str, str]) -> str:
    """Read and validate the authoritative Issue reference from Spec metadata."""
    source_issue = frontmatter.get("source_issue", "").strip()
    return canonical_issue_ref(source_issue)


def spec_id_from_title(content: str) -> str | None:
    match = re.search(r"^#\s+\[([A-Z0-9][A-Z0-9._-]*)\]\s+—", content, re.MULTILINE)
    if not match:
        return None
    return match.group(1)


def specs_for_issue(spec_dir: Path, issue_ref: str) -> list[Path]:
    """Find Specs whose frontmatter authorizes the supplied GitHub Issue."""
    issue_ref = canonical_issue_ref(issue_ref)
    matches: list[Path] = []
    for path in sorted(spec_dir.glob("*.md")):
        content = path.read_text(encoding="utf-8")
        frontmatter = _parse_frontmatter(content)
        try:
            source_issue = extract_source_issue(frontmatter)
        except ValueError:
            continue
        spec_id = spec_id_from_title(content)
        if source_issue == issue_ref and spec_id and SPEC_REF_RE.fullmatch(spec_id):
            matches.append(path)
    return matches


def resolve_spec_for_issue(spec_dir: Path, issue_ref: str) -> Path:
    """Resolve exactly one canonical Spec for a material GitHub Issue."""
    matches = specs_for_issue(spec_dir, issue_ref)
    if not matches:
        raise LookupError(f"no Specification found for GitHub Issue {issue_ref}")
    if len(matches) > 1:
        names = ", ".join(path.name for path in matches)
        raise LookupError(f"multiple Specifications found for GitHub Issue {issue_ref}: {names}")
    return matches[0]


def _parse_frontmatter(content: str) -> dict[str, str]:
    match = re.match(r"^---\n(.*?)\n---\n", content, re.DOTALL)
    if not match:
        return {}
    values: dict[str, str] = {}
    for line in match.group(1).splitlines():
        key, separator, value = line.partition(":")
        if separator:
            values[key.strip()] = value.strip().strip('"')
    return values
