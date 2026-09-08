#!/usr/bin/env python3
"""Smoke/unit tests for the dependency-free AI Factory validator."""
from __future__ import annotations

import subprocess
import sys
import tempfile
import unittest
from pathlib import Path

from validate import (
    ID_PATTERNS,
    HARNESS_HEADINGS,
    TEMPLATES,
    TRACEABILITY_CHAIN,
    artifact_references,
    has_markdown_heading,
    validate_plan,
    validate_harness,
    validate_spec,
    validate_task,
    validate_task_graph,
)

ROOT = Path(__file__).resolve().parents[2]
VALIDATOR = ROOT / "scripts" / "ai-factory" / "validate.py"


class ValidatorTests(unittest.TestCase):
    def valid_spec(self, **overrides: str) -> str:
        metadata = {
            "id": "SPEC-TEST-001",
            "status": "Accepted",
            "version": "1",
            "owner": "test",
            "created": "2026-09-08",
            "updated": "2026-09-08",
        }
        metadata.update(overrides)
        frontmatter = "\n".join(f"{key}: {value}" for key, value in metadata.items())
        sections = []
        for heading in TEMPLATES["spec.md"]:
            body = "Content."
            if heading == "## Acceptance Criteria":
                body = "- [ ] `AC-01` Measurable outcome. **Evidence:** static check"
            sections.append(f"{heading}\n\n{body}")
        return f"---\n{frontmatter}\n---\n\n# [SPEC-TEST-001] — Test\n\n" + "\n\n".join(sections) + f"\n\n{TRACEABILITY_CHAIN}\n"

    def valid_plan(self, **overrides: str) -> str:
        metadata = {
            "id": "PLAN-TEST-001",
            "status": "Ready",
            "version": "1",
            "source_spec": "SPEC-0001",
            "source_spec_version": "2",
            "baseline_revision": "232c2922eca1eadc7deccf4d6509da0430566010",
            "owner": "test",
            "created": "2026-09-06",
            "updated": "2026-09-06",
        }
        metadata.update(overrides)
        frontmatter = "\n".join(f"{key}: {value}" for key, value in metadata.items())
        headings = "\n\n".join(f"{heading}\n\nContent." for heading in TEMPLATES["plan.md"])
        return f"---\n{frontmatter}\n---\n\n# [PLAN-TEST-001] — Test\n\n{headings}\n\n{TRACEABILITY_CHAIN}\n"

    def valid_task(self, **overrides: str) -> str:
        metadata = {
            "id": "TASK-TEST-001",
            "status": "Blocked",
            "version": "1",
            "source_issue": '"#106"',
            "source_spec": "SPEC-0004",
            "source_spec_version": "1",
            "source_plan": "PLAN-0001",
            "source_plan_version": "1",
            "baseline_revision": "aced10e53c76df40debb25fc5d07c74a0a7b5424",
            "owner": "test",
            "created": "2026-09-07",
            "updated": "2026-09-07",
        }
        metadata.update(overrides)
        frontmatter = "\n".join(f"{key}: {value}" for key, value in metadata.items())
        sections = []
        for heading in TEMPLATES["task.md"]:
            body = "Content."
            if heading == "## Acceptance Criteria":
                body = "- [ ] `AC-01` Measurable outcome. **Evidence:** static check"
            elif heading == "## Verification Command":
                body = "```bash\npython scripts/ai-factory/validate.py\n```"
            sections.append(f"{heading}\n\n{body}")
        return f"---\n{frontmatter}\n---\n\n# [TASK-TEST-001] — Test\n\n" + "\n\n".join(sections) + f"\n\n{TRACEABILITY_CHAIN}\n"

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
        self.assertNotRegex("TASK-ORDERS-", ID_PATTERNS["tasks"])

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

    def test_direct_harness_contract_is_enforced(self) -> None:
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            (root / "docs" / "agents").mkdir(parents=True)
            (root / ".cursor" / "rules").mkdir(parents=True)
            harness = "# Direct Agent Harness\n\n" + "\n\n".join(
                f"{heading}\n\nContent." for heading in HARNESS_HEADINGS
            )
            (root / "docs" / "agents" / "harness.md").write_text(harness, encoding="utf-8")
            (root / "AGENTS.md").write_text("docs/agents/harness.md\n", encoding="utf-8")
            (root / "docs" / "agents" / "README.md").write_text("harness.md\n", encoding="utf-8")
            (root / "docs" / "agents" / "execution-protocol.md").write_text("Direct.\n", encoding="utf-8")
            (root / "docs" / "agents" / "context-policy.md").write_text("Direct.\n", encoding="utf-8")
            (root / ".cursor" / "rules" / "01-task-execution.mdc").write_text("Direct.\n", encoding="utf-8")
            legacy_rule = root / ".cursor" / "rules" / "06-orchestrator.mdc"
            legacy_rule.write_text("---\nalwaysApply: false\n---\n", encoding="utf-8")

            errors: list[str] = []
            validate_harness(errors, root)
            self.assertEqual(errors, [])

            (root / "docs" / "agents" / "execution-protocol.md").write_text(
                "Run scripts/orchestrator/next.py.\n", encoding="utf-8"
            )
            legacy_rule.write_text("---\nalwaysApply: true\n---\n", encoding="utf-8")
            errors = []
            validate_harness(errors, root)
            self.assertTrue(any("must not require the legacy orchestrator" in error for error in errors))
            self.assertIn(".cursor/rules/06-orchestrator.mdc must be inactive by default", errors)

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
            self.valid_plan(source_spec_version="1"),
            "PLAN-TEST-001",
            errors,
        )
        self.assertTrue(any("does not match SPEC-0001 version 2" in error for error in errors))

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

    def test_valid_blocked_task_matches_draft_plan_version(self) -> None:
        errors: list[str] = []
        validate_task(Path("task.md"), self.valid_task(), "TASK-TEST-001", errors)
        self.assertEqual(errors, [])

    def test_task_does_not_require_external_issue(self) -> None:
        errors: list[str] = []
        content = self.valid_task().replace('source_issue: "#106"\n', "")
        validate_task(Path("task.md"), content, "TASK-TEST-001", errors)
        self.assertEqual(errors, [])

        errors = []
        validate_task(
            Path("task.md"),
            self.valid_task(source_issue='"issue-106"'),
            "TASK-TEST-001",
            errors,
        )
        self.assertIn(
            "task.md has invalid source_issue; expected canonical GitHub Issue reference #<number>: issue-106",
            errors,
        )

    def test_specification_does_not_require_external_issue(self) -> None:
        errors: list[str] = []
        validate_spec(Path("spec.md"), self.valid_spec(), "SPEC-TEST-001", errors)
        self.assertEqual(errors, [])

        errors = []
        validate_spec(
            Path("spec.md"),
            self.valid_spec(source_issue='"issue-12"'),
            "SPEC-TEST-001",
            errors,
        )
        self.assertIn(
            "spec.md has invalid source_issue; expected canonical GitHub Issue reference #<number>: issue-12",
            errors,
        )

    def test_executable_task_requires_ready_source_plan(self) -> None:
        errors: list[str] = []
        validate_task(
            Path("task.md"),
            self.valid_task(status="Ready"),
            "TASK-TEST-001",
            errors,
        )
        self.assertIn("task.md is Ready but source Plan PLAN-0001 is not Ready", errors)

    def test_task_rejects_source_drift_and_incomplete_done_state(self) -> None:
        errors: list[str] = []
        content = self.valid_task(
            status="Done",
            source_plan_version="2",
            source_spec_version="2",
        )
        validate_task(Path("task.md"), content, "TASK-TEST-001", errors)
        self.assertIn("task.md is Done but has unchecked acceptance criteria", errors)
        self.assertTrue(any("source_plan_version 2 does not match PLAN-0001 version 1" in error for error in errors))
        self.assertTrue(any("source_spec_version 2 does not match PLAN-0001" in error for error in errors))

    def test_task_requires_exact_command_and_contract_sections(self) -> None:
        errors: list[str] = []
        content = self.valid_task(owner="").replace("## Allowed Files", "## Files")
        content = content.replace(
            "```bash\npython scripts/ai-factory/validate.py\n```",
            "```bash\n...\n```",
        )
        validate_task(Path("task.md"), content, "TASK-TEST-001", errors)
        self.assertIn("task.md missing required Task frontmatter field: owner", errors)
        self.assertIn("task.md missing required Task heading: ## Allowed Files", errors)
        self.assertIn("task.md must contain an exact fenced verification command", errors)

    def test_task_graph_rejects_missing_blocked_and_cyclic_dependencies(self) -> None:
        with tempfile.TemporaryDirectory() as directory:
            task_dir = Path(directory)

            def write_task(task_id: str, status: str, dependencies: str) -> None:
                (task_dir / f"{task_id}.md").write_text(
                    f"---\nid: {task_id}\nstatus: {status}\n---\n\n"
                    f"# [{task_id}] — Test\n\n## Dependencies\n\n{dependencies}\n",
                    encoding="utf-8",
                )

            write_task("TASK-A", "Ready", "`TASK-B`")
            write_task("TASK-B", "Blocked", "`TASK-A`")
            write_task("TASK-C", "Blocked", "`TASK-MISSING`")
            write_task("TASK-D", "Blocked", "`TASK-D`")

            errors: list[str] = []
            validate_task_graph(errors, task_dir)

            self.assertTrue(any("TASK-B is Blocked, not Done" in error for error in errors))
            self.assertTrue(any("references missing Task dependency: TASK-MISSING" in error for error in errors))
            self.assertTrue(any("cannot depend on itself: TASK-D" in error for error in errors))
            self.assertTrue(any("Task dependency cycle detected" in error for error in errors))

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
