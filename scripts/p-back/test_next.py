#!/usr/bin/env python3
"""Shim tests: p-back/p-front next.py now delegate to the GitHub orchestrator."""

from __future__ import annotations

import json
import subprocess
import tempfile
import unittest
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]


class ShimTests(unittest.TestCase):
    def test_p_back_shim_filters_backend(self) -> None:
        issues = [
            {
                "number": 40,
                "title": "P0 — Implementar máquina de estados de Order",
                "body": "Order state machine.",
                "labels": [{"name": "priority:P0"}, {"name": "orders"}],
                "url": "https://example.test/40",
            },
            {
                "number": 82,
                "title": "[Frontend] Enviar Idempotency-Key na criação de pedido",
                "body": "Checkout header.",
                "labels": [],
                "url": "https://example.test/82",
            },
        ]
        with tempfile.TemporaryDirectory() as tmp:
            tmp_path = Path(tmp)
            issues_path = tmp_path / "issues.json"
            prs_path = tmp_path / "prs.json"
            subjects_path = tmp_path / "subjects.json"
            issues_path.write_text(json.dumps(issues), encoding="utf-8")
            prs_path.write_text("[]", encoding="utf-8")
            subjects_path.write_text("[]", encoding="utf-8")
            result = subprocess.run(
                [
                    "python3",
                    str(ROOT / "scripts/p-back/next.py"),
                    "--json",
                    "--issues-json",
                    str(issues_path),
                    "--prs-json",
                    str(prs_path),
                    "--subjects-json",
                    str(subjects_path),
                ],
                cwd=ROOT,
                text=True,
                capture_output=True,
                check=False,
            )
            self.assertEqual(result.returncode, 0, result.stderr)
            payload = json.loads(result.stdout)
            self.assertEqual([item["issue"] for item in payload["spawn"]], [40])
            self.assertEqual(payload["spawn"][0]["track"], "backend")


if __name__ == "__main__":
    unittest.main()
