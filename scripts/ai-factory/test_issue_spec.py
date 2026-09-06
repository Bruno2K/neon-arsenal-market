from pathlib import Path

import pytest

from issue_spec import canonical_issue_ref, resolve_spec_for_issue, specs_for_issue


def write_spec(path: Path, issue: str, spec_id: str = "SPEC-TEST-001") -> None:
    path.write_text(
        f'''---\nid: {spec_id}\nstatus: Accepted\nversion: 1\nsource_issue: "{issue}"\nowner: team\ncreated: 2026-09-06\nupdated: 2026-09-06\n---\n\n# [{spec_id}] — Example\n''',
        encoding="utf-8",
    )


def test_canonical_issue_ref_accepts_issue_number() -> None:
    assert canonical_issue_ref(" #173 ") == "#173"


@pytest.mark.parametrize("value", ["173", "#0", "#-1", "issue-173", "# 173"])
def test_canonical_issue_ref_rejects_non_canonical_values(value: str) -> None:
    with pytest.raises(ValueError):
        canonical_issue_ref(value)


def test_specs_for_issue_returns_matching_spec(tmp_path: Path) -> None:
    write_spec(tmp_path / "spec.md", "#173")
    write_spec(tmp_path / "other.md", "#174", "SPEC-TEST-002")

    assert specs_for_issue(tmp_path, "#173") == [tmp_path / "spec.md"]


def test_resolver_blocks_missing_spec(tmp_path: Path) -> None:
    with pytest.raises(LookupError, match="no Specification"):
        resolve_spec_for_issue(tmp_path, "#173")


def test_resolver_blocks_ambiguous_issue(tmp_path: Path) -> None:
    write_spec(tmp_path / "a.md", "#173", "SPEC-TEST-001")
    write_spec(tmp_path / "b.md", "#173", "SPEC-TEST-002")

    with pytest.raises(LookupError, match="multiple Specifications"):
        resolve_spec_for_issue(tmp_path, "#173")


def test_malformed_source_issue_is_not_resolved(tmp_path: Path) -> None:
    write_spec(tmp_path / "bad.md", "Factory F2.1 / F2.5")

    assert specs_for_issue(tmp_path, "#173") == []
