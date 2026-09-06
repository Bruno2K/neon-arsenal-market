#!/usr/bin/env python3
"""Smoke/unit tests for the dependency-free AI Factory validator."""
from __future__ import annotations

import subprocess
import sys
import unittest
from pathlib import Path

from validate import (
    ID_PATTERNS,
    TEMPLATES,
    TRACEABILITY_CHAIN,
    artifact_references,
    has_markdown_heading,
    validate_plan,
)

ROOT = Path(__file__).resolve().parents[2]
VALIDATOR = ROOT / "scripts" / "ai-factory" / "validate.py"


class ValidatorTests(unittest.TestCase):
    def valid_plan(self, **overrides: str) -> str:
        metadata = {
            "id": "PLAN-TEST-001",
            "status": "Ready",
            "version": "1",
            "source_spec": "SPEC-0001",
            "source_spec_version": "1",
            "baseline_revision": "232c2922eca1eadc7deccf4d6509da0430566010",
            "owner": "test",
            "created": "2026-09-06",
            "updated": "2026-09-06",
        }
        metadata.update(overrides)
        frontmatter = "\n".join(f"{key}: {value}" for key, value in metadata.items())
        headings = "\n\n".join(f"{heading}\n\nContent." for heading in TEMPLATES["plan.md"])
        return f"---\n{frontmatter}\n---\n\n# [PLAN-TEST-001] — Test\n\n{headings}\n\n{TRACEABILITY_CHAIN}\n"

    def test_canonical_id_patterns(self) -> None:
        valid = {
            "specs": "SPEC-ORDERS-001",
            "plans": "PLAN-ORDERS-001",
            "tasks": "TASK-ORDERS-001",
            "evaluations": "EVAL-ORDERS-001",
            "memory": "MEM-ORDERS-001",
        }
        for kind, value in valid.items():
            self.assertRegex(value, ID_PATTERNS[kind])

        self.assertNotRegex("SPEC-orders-001", ID_PATTERNS["specs"])
        self.assertNotRegex("ORDER-001", ID_PATTERNS["specs"])
        self.assertNotRegex("PLAN-ORDERS-", ID_PATTERNS["plans"])

    def test_artifact_reference_extraction_trims_paths_and_punctuation(self) -> None:
        content = "docs/plans/PLAN-0001-plan.md references PLAN-0001."
        self.assertEqual(artifact_references(content, "PLAN-"), ["PLAN-0001"])

    def test_heading_match_is_exact_and_ignores_fences(self) -> None:
        self.assertTrue(has_markdown_heading("## Database\n", "## Database"))
        self.assertFalse(has_markdown_heading("### Database\n", "## Database"))
        self.assertFalse(has_markdown_heading("## Database extra\n", "## Database"))
        self.assertFalse(has_markdown_heading("```text\n## Database\n```\n", "## Database"))

    def test_template_contracts_are_non_empty(self) -> None:
        for filename, headings in TEMPLATES.items():
            path = ROOT / "docs" / "templates" / filename
            self.assertTrue(path.is_file(), filename)
            content = path.read_text(encoding="utf-8")
            for heading in headings:
                self.assertIn(heading, content)

    def test_valid_ready_plan_matches_accepted_source_version(self) -> None:
        errors: list[str] = []
        validate_plan(Path("plan.md"), self.valid_plan(), "PLAN-TEST-001", errors)
        self.assertEqual(errors, [])

    def test_plan_rejects_invalid_status_and_source_version(self) -> None:
        errors: list[str] = []
        content = self.valid_plan(status="Executing", source_spec_version="2")
        validate_plan(Path("plan.md"), content, "PLAN-TEST-001", errors)
        self.assertIn("plan.md has invalid Plan status: Executing", errors)

        errors = []
        validate_plan(
            Path("plan.md"),
            self.valid_plan(source_spec_version="2"),
            "PLAN-TEST-001",
            errors,
        )
        self.assertTrue(any("does not match SPEC-0001 version 1" in error for error in errors))

    def test_ready_plan_requires_an_accepted_source_specification(self) -> None:
        errors: list[str] = []
        validate_plan(
            Path("plan.md"),
            self.valid_plan(source_spec="SPEC-0004"),
            "PLAN-TEST-001",
            errors,
        )
        self.assertIn("plan.md is Ready but source Specification SPEC-0004 is not Accepted", errors)

        errors = []
        validate_plan(
            Path("plan.md"),
            self.valid_plan(status="Draft", source_spec="SPEC-0004"),
            "PLAN-TEST-001",
            errors,
        )
        self.assertEqual(errors, [])

    def test_plan_rejects_malformed_source_metadata(self) -> None:
        errors: list[str] = []
        validate_plan(
            Path("plan.md"),
            self.valid_plan(source_spec="spec-0001", source_spec_version="latest"),
            "PLAN-TEST-001",
            errors,
        )
        self.assertIn("plan.md has invalid source_spec: spec-0001", errors)
        self.assertIn("plan.md has non-numeric Plan source_spec_version: latest", errors)

        errors = []
        validate_plan(
            Path("plan.md"),
            self.valid_plan(baseline_revision="main"),
            "PLAN-TEST-001",
            errors,
        )
        self.assertIn(
            "plan.md has invalid baseline_revision; expected a 40-character Git commit",
            errors,
        )

        errors = []
        missing_commit = "0" * 40
        validate_plan(
            Path("plan.md"),
            self.valid_plan(baseline_revision=missing_commit),
            "PLAN-TEST-001",
            errors,
        )
        self.assertIn(
            f"plan.md baseline_revision does not resolve to a repository commit: {missing_commit}",
            errors,
        )

    def test_plan_requires_metadata_sections_and_traceability(self) -> None:
        errors: list[str] = []
        content = self.valid_plan(owner="").replace("## Database", "## Data")
        content = content.replace(TRACEABILITY_CHAIN, "Issue to implementation")
        validate_plan(Path("plan.md"), content, "PLAN-TEST-001", errors)
        self.assertIn("plan.md missing required Plan frontmatter field: owner", errors)
        self.assertIn("plan.md missing required Plan heading: ## Database", errors)
        self.assertIn("plan.md is missing the canonical traceability chain", errors)

        for replacement in ("### Database", "## Database extra"):
            with self.subTest(replacement=replacement):
                errors = []
                validate_plan(
                    Path("plan.md"),
                    self.valid_plan().replace("## Database", replacement),
                    "PLAN-TEST-001",
                    errors,
                )
                self.assertIn("plan.md missing required Plan heading: ## Database", errors)

        errors = []
        fenced_only = self.valid_plan().replace(
            "## Database\n\nContent.",
            "```text\n## Database\n```",
        )
        validate_plan(Path("plan.md"), fenced_only, "PLAN-TEST-001", errors)
        self.assertIn("plan.md missing required Plan heading: ## Database", errors)

    def test_repository_validation_passes(self) -> None:
        result = subprocess.run(
            [sys.executable, str(VALIDATOR)],
            cwd=ROOT,
            capture_output=True,
            text=True,
            check=False,
        )
        self.assertEqual(result.returncode, 0, result.stdout + result.stderr)
        self.assertIn("AI Factory artifact validation: PASS", result.stdout)


if __name__ == "__main__":
    unittest.main()
