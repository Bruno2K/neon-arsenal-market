#!/usr/bin/env python3
"""Unit tests for the unified GitHub-issue orchestrator (no gh required)."""

from __future__ import annotations

import importlib.util
import io
import json
import sys
import tempfile
import unittest
from contextlib import redirect_stdout
from pathlib import Path

HERE = Path(__file__).resolve().parent
SPEC = importlib.util.spec_from_file_location("orch_next", HERE / "next.py")
assert SPEC and SPEC.loader
orch = importlib.util.module_from_spec(SPEC)
sys.modules["orch_next"] = orch
SPEC.loader.exec_module(orch)


def issue(
    number: int,
    title: str,
    *,
    labels: list[str] | None = None,
    body: str = "",
    url: str | None = None,
) -> orch.Issue:
    return orch.Issue(
        number=number,
        title=title,
        body=body,
        url=url or f"https://example.test/{number}",
        labels=tuple(labels or ()),
    )


def classify(
    item: orch.Issue,
    *,
    subjects: list[str] | None = None,
    prs: list[orch.PullRequest] | None = None,
    aws_allowed: bool = False,
) -> orch.Classified:
    return orch.classify_issue(
        item,
        subjects=subjects or [],
        prs=prs or [],
        aws_allowed=aws_allowed,
    )


class TrackAndRoleTests(unittest.TestCase):
    def test_frontend_title_prefix(self) -> None:
        item = classify(
            issue(
                82,
                "[Frontend] Enviar Idempotency-Key na criação de pedido",
                body="Checkout deve enviar Idempotency-Key e PayPal retry.",
            )
        )
        self.assertEqual(item.track, "frontend")
        self.assertEqual(item.primary_role, "Implementation")
        self.assertIn("Security", item.roles)
        self.assertIn("Verification", item.roles)
        self.assertEqual(item.priority, "P1")
        self.assertTrue(item.correctness)

    def test_backend_payment_roles(self) -> None:
        item = classify(
            issue(
                39,
                "P0 — Tornar criação de payment link idempotente",
                labels=["enhancement", "reliability", "priority:P0", "payments"],
                body="Duas requisições simultâneas não podem chamar PayPal OrdersCreate duas vezes.",
            )
        )
        self.assertEqual(item.track, "backend")
        self.assertEqual(item.priority, "P0")
        self.assertEqual(
            item.roles,
            ("Backend", "Reliability", "Security", "Test", "Verification"),
        )

    def test_order_concurrency_roles(self) -> None:
        item = classify(
            issue(
                40,
                "P0 — Implementar máquina de estados de Order",
                labels=["enhancement", "architecture", "priority:P0", "orders"],
                body="Reservation e transições de Order precisam de schema e testes de concorrência.",
            )
        )
        self.assertEqual(item.primary_role, "Backend")
        self.assertIn("Database/Concurrency", item.roles)

    def test_docs_architecture_roles(self) -> None:
        item = classify(
            issue(
                70,
                "P2 — Criar diagramas de arquitetura e sequence diagrams",
                labels=["documentation", "architecture", "priority:P2"],
            )
        )
        self.assertEqual(
            item.roles, ("Planner", "Architecture", "Verification")
        )

    def test_probe_skipped(self) -> None:
        item = classify(issue(79, "test-write-probe-do-not-keep"))
        self.assertEqual(item.track, "skip")
        self.assertEqual(item.skip_reason, "probe/test issue")


class GateTests(unittest.TestCase):
    def test_redis_mention_in_body_does_not_gate(self) -> None:
        item = classify(
            issue(
                121,
                "[UX] Permitir reenvio do código de verificação no cadastro",
                body="Não depende de Redis (#47 é redis futuro).",
            )
        )
        self.assertIsNone(item.gate_reason)
        self.assertEqual(item.track, "frontend")

    def test_redis_is_gated(self) -> None:
        item = classify(
            issue(
                47,
                "P1 — Distributed rate limiting com Redis",
                labels=["enhancement", "security", "priority:P1", "redis"],
            )
        )
        self.assertIsNotNone(item.gate_reason)
        self.assertIn("Redis", item.gate_reason or "")

    def test_aws_gated_when_adr_keeps_render(self) -> None:
        item = classify(
            issue(
                67,
                "P2 — Infraestrutura AWS como código com Terraform",
                labels=["infrastructure", "priority:P2", "aws", "terraform"],
            ),
            aws_allowed=False,
        )
        self.assertIsNotNone(item.gate_reason)
        self.assertIn("ADR 0007", item.gate_reason or "")

    def test_aws_not_gated_when_explicitly_allowed(self) -> None:
        item = classify(
            issue(
                67,
                "P2 — Infraestrutura AWS como código com Terraform",
                labels=["infrastructure", "priority:P2", "aws", "terraform"],
            ),
            aws_allowed=True,
        )
        self.assertIsNone(item.gate_reason)


class DoneAndBusyTests(unittest.TestCase):
    def test_payment_link_matches_r1_commit(self) -> None:
        item = classify(
            issue(
                39,
                "P0 — Tornar criação de payment link idempotente",
                labels=["priority:P0", "payments"],
            ),
            subjects=["[P-back] R1 — Idempotência do link de pagamento"],
        )
        self.assertIsNotNone(item.likely_done_subject)

    def test_unrelated_title_is_not_done(self) -> None:
        item = classify(
            issue(82, "[Frontend] Enviar Idempotency-Key na criação de pedido"),
            subjects=["[P-back] R1 — Idempotência do link de pagamento"],
        )
        self.assertIsNone(item.likely_done_subject)

    def test_busy_when_pr_mentions_issue(self) -> None:
        prs = [
            orch.PullRequest(
                number=200,
                title="Fix checkout header",
                url="https://example.test/pr/200",
                body="Fixes #82",
            )
        ]
        item = classify(
            issue(82, "[Frontend] Enviar Idempotency-Key na criação de pedido"),
            prs=prs,
        )
        self.assertEqual(item.busy_url, "https://example.test/pr/200")


class DependsOnTests(unittest.TestCase):
    def test_parses_dependencies_section(self) -> None:
        body = "### Dependências\n\n- Backend já implementado. Não reabrir #5.\n"
        # The regex looks at the same line as "Dependências". A later-line #5
        # should not count unless the label is on that line.
        self.assertEqual(orch.parse_depends_on(body), ())
        self.assertEqual(
            orch.parse_depends_on("Depends on: #40, #41"), (40, 41)
        )

    def test_open_dependency_blocks_spawn(self) -> None:
        items = [
            classify(
                issue(
                    41,
                    "P0 — Converter estados críticos de String para enums Prisma",
                    labels=["priority:P0", "database"],
                    body="Depends on: #40",
                )
            ),
            classify(
                issue(
                    40,
                    "P0 — Implementar máquina de estados de Order",
                    labels=["priority:P0", "orders"],
                )
            ),
        ]
        spawn = orch.select_spawn(items, track="backend", limit=2, issue_number=None)
        self.assertEqual([item.issue.number for item in spawn], [40])


class SelectSpawnTests(unittest.TestCase):
    def setUp(self) -> None:
        self.backend_p0 = classify(
            issue(
                40,
                "P0 — Implementar máquina de estados de Order",
                labels=["priority:P0", "orders"],
                body="Máquina de estados da Order e reserva.",
            )
        )
        self.backend_p2 = classify(
            issue(
                62,
                "P2 — Observabilidade operacional com dashboards",
                labels=["observability", "priority:P2"],
            )
        )
        self.frontend = classify(
            issue(
                82,
                "[Frontend] Enviar Idempotency-Key na criação de pedido",
                body="Checkout Idempotency-Key e PayPal.",
            )
        )
        self.gated = classify(
            issue(
                47,
                "P1 — Distributed rate limiting com Redis",
                labels=["priority:P1", "redis"],
            )
        )

    def test_picks_one_backend_and_one_frontend(self) -> None:
        spawn = orch.select_spawn(
            [self.backend_p2, self.frontend, self.backend_p0, self.gated],
            track="all",
            limit=2,
            issue_number=None,
        )
        numbers = [item.issue.number for item in spawn]
        self.assertEqual(numbers, [40, 82])

    def test_does_not_spawn_p2_backend_when_p0_exists_same_track(self) -> None:
        spawn = orch.select_spawn(
            [self.backend_p0, self.backend_p2],
            track="backend",
            limit=2,
            issue_number=None,
        )
        self.assertEqual([item.issue.number for item in spawn], [40])

    def test_skips_likely_done_and_gated(self) -> None:
        done = classify(
            issue(
                39,
                "P0 — Tornar criação de payment link idempotente",
                labels=["priority:P0", "payments"],
            ),
            subjects=["[P-back] R1 — Idempotência do link de pagamento"],
        )
        spawn = orch.select_spawn(
            [done, self.gated, self.backend_p0],
            track="backend",
            limit=2,
            issue_number=None,
        )
        self.assertEqual([item.issue.number for item in spawn], [40])

    def test_issue_flag_overrides_selection(self) -> None:
        spawn = orch.select_spawn(
            [self.backend_p0, self.frontend],
            track="all",
            limit=2,
            issue_number=82,
        )
        self.assertEqual([item.issue.number for item in spawn], [82])


class PromptAndCliTests(unittest.TestCase):
    def test_prompt_names_role_issue_and_cursor_rules(self) -> None:
        item = classify(
            issue(
                82,
                "[Frontend] Enviar Idempotency-Key na criação de pedido",
                body="Enviar Idempotency-Key no POST /orders.",
            )
        )
        prompt = orch.agent_prompt(item)
        self.assertIn("issue #82", prompt)
        self.assertIn("Implementation", prompt)
        self.assertIn(".cursor/rules/", prompt)
        self.assertIn("`src/`", prompt)
        self.assertIn("server/", prompt)
        self.assertIn("cursor/issue-82-", prompt)
        self.assertNotIn("scripts/p-front/activities.json", prompt)

    def test_cli_json_spawn_from_fixtures(self) -> None:
        issues = [
            {
                "number": 40,
                "title": "P0 — Implementar máquina de estados de Order",
                "body": "Order state machine and reservation.",
                "labels": [{"name": "priority:P0"}, {"name": "orders"}],
                "url": "https://example.test/40",
            },
            {
                "number": 82,
                "title": "[Frontend] Enviar Idempotency-Key na criação de pedido",
                "body": "Checkout Idempotency-Key.",
                "labels": [],
                "url": "https://example.test/82",
            },
            {
                "number": 47,
                "title": "P1 — Distributed rate limiting com Redis",
                "body": "Use Redis.",
                "labels": [{"name": "priority:P1"}, {"name": "redis"}],
                "url": "https://example.test/47",
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
            buf = io.StringIO()
            with redirect_stdout(buf):
                code = orch.main(
                    [
                        "--json",
                        "--issues-json",
                        str(issues_path),
                        "--prs-json",
                        str(prs_path),
                        "--subjects-json",
                        str(subjects_path),
                    ]
                )
            self.assertEqual(code, 0)
            payload = json.loads(buf.getvalue())
            self.assertEqual(
                [item["issue"] for item in payload["spawn"]], [40, 82]
            )
            self.assertTrue(payload["parentMustSpawnSubagents"])
            self.assertEqual(payload["blocked"][0]["issue"], 47)


if __name__ == "__main__":
    unittest.main()
