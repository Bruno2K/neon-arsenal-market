#!/usr/bin/env python3
"""Smoke/unit tests for the dependency-free AI Factory validator."""
from __future__ import annotations

import subprocess
import sys
import unittest
from pathlib import Path

from validate import ID_PATTERNS, TEMPLATES

ROOT = Path(__file__).resolve().parents[2]
VALIDATOR = ROOT / "scripts" / "ai-factory" / "validate.py"


class ValidatorTests(unittest.TestCase):
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

    def test_template_contracts_are_non_empty(self) -> None:
        for filename, headings in TEMPLATES.items():
            path = ROOT / "docs" / "templates" / filename
            self.assertTrue(path.is_file(), filename)
            content = path.read_text(encoding="utf-8")
            for heading in headings:
                self.assertIn(heading, content)

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
