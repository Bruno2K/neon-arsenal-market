#!/usr/bin/env python3
"""Unit tests for P-back next-activity selection (no git/gh required)."""

from __future__ import annotations

import importlib.util
import json
import unittest
from pathlib import Path

HERE = Path(__file__).resolve().parent
SPEC = importlib.util.spec_from_file_location("p_back_next", HERE / "next.py")
assert SPEC and SPEC.loader
p_back_next = importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(p_back_next)


def catalog() -> dict:
    return json.loads((HERE / "activities.json").read_text(encoding="utf-8"))


class MarkerTests(unittest.TestCase):
    def test_default_done_marker(self) -> None:
        activity = {"id": "R1"}
        self.assertEqual(p_back_next.done_markers_for(activity), ["[P-back] R1"])
        self.assertTrue(
            p_back_next.activity_is_done(
                activity, "[P-back] R1 — Idempotência do link de pagamento\n"
            )
        )
        self.assertFalse(
            p_back_next.activity_is_done(activity, "[P-back] R2 — other\n")
        )

    def test_legacy_done_ignores_git_log(self) -> None:
        activity = {"id": "P0.1", "legacyDone": True}
        self.assertTrue(p_back_next.activity_is_done(activity, ""))

    def test_p14_historical_commit_subject(self) -> None:
        activities = {item["id"]: item for item in catalog()["activities"]}
        p14 = activities["P1.4"]
        log = "feat(perf): add P1.4 query-plan evidence and hot-path indexes\n"
        self.assertTrue(p_back_next.activity_is_done(p14, log))

    def test_busy_default_and_custom_markers(self) -> None:
        prs = [
            {
                "title": "P1.4: Performance evidence and hot-path indexes",
                "url": "https://example.test/p14",
                "number": 33,
            }
        ]
        p14 = {
            "id": "P1.4",
            "busyMarkers": ["[P-back] P1.4", "P1.4:"],
        }
        self.assertEqual(
            p_back_next.activity_busy_url(p14, prs), "https://example.test/p14"
        )
        self.assertIsNone(p_back_next.activity_busy_url({"id": "R1"}, prs))


class SelectNextTests(unittest.TestCase):
    def setUp(self) -> None:
        self.catalog = catalog()

    def test_b01_is_next_when_historical_done(self) -> None:
        done = {item["id"] for item in self.catalog["activities"] if item.get("legacyDone")}
        ready = p_back_next.select_next(self.catalog, done, {})
        self.assertEqual(ready[0]["id"], "B0.1")

    def test_after_b01_r1_is_first_among_unblocked(self) -> None:
        done = {
            item["id"]
            for item in self.catalog["activities"]
            if item.get("legacyDone") or item["id"] == "B0.1"
        }
        ready = p_back_next.select_next(self.catalog, done, {})
        self.assertEqual(ready[0]["id"], "R1")
        self.assertEqual(
            [item["id"] for item in ready],
            ["R1", "R2", "O1", "D1", "D2"],
        )

    def test_skips_busy_and_waits_for_deps(self) -> None:
        done = {
            item["id"]
            for item in self.catalog["activities"]
            if item.get("legacyDone") or item["id"] == "B0.1"
        }
        busy = {"R1": "https://example.test/r1"}
        ready = p_back_next.select_next(self.catalog, done, busy)
        self.assertEqual([item["id"] for item in ready], ["R2", "O1", "D1", "D2"])

    def test_c1_waits_for_o1_and_d1(self) -> None:
        done = {"B0.1", "P1.3", "O1"}
        ready_ids = [item["id"] for item in p_back_next.select_next(self.catalog, done, {})]
        self.assertNotIn("C1", ready_ids)
        done.add("D1")
        ready_ids = [item["id"] for item in p_back_next.select_next(self.catalog, done, {})]
        self.assertIn("C1", ready_ids)

    def test_c2_only_after_c1(self) -> None:
        done = {item["id"] for item in self.catalog["activities"] if item["id"] != "C2"}
        ready = p_back_next.select_next(self.catalog, done, {})
        self.assertEqual([item["id"] for item in ready], ["C2"])

    def test_complete_payload(self) -> None:
        ids = {item["id"] for item in self.catalog["activities"]}
        payload = p_back_next.build_payload(self.catalog, ids, {})
        self.assertTrue(payload["complete"])
        self.assertIsNone(payload["next"])

    def test_blocked_is_not_complete(self) -> None:
        done = {item["id"] for item in self.catalog["activities"] if item["id"] != "B0.1"}
        payload = p_back_next.build_payload(
            self.catalog, done, {"B0.1": "https://example.test/b01"}
        )
        self.assertFalse(payload["complete"])
        self.assertIsNone(payload["next"])


class CatalogContractTests(unittest.TestCase):
    def test_forbidden_paths_protect_p_front(self) -> None:
        data = catalog()
        self.assertIn("src/", data["forbiddenGlobally"])
        self.assertIn("docs/frontend-sprint.md", data["forbiddenGlobally"])
        self.assertIn("scripts/p-front/", data["forbiddenGlobally"])

    def test_activity_ids_unique_and_ordered(self) -> None:
        ids = [item["id"] for item in catalog()["activities"]]
        self.assertEqual(len(ids), len(set(ids)))
        self.assertEqual(
            ids,
            [
                "P0.1",
                "P0.2",
                "P0.3",
                "P1.1",
                "P1.2",
                "P1.3",
                "P1.4",
                "B0.1",
                "R1",
                "R2",
                "O1",
                "D1",
                "D2",
                "C1",
                "C2",
            ],
        )

    def test_cloud_is_gated_on_c1(self) -> None:
        activities = {item["id"]: item for item in catalog()["activities"]}
        self.assertEqual(activities["C1"]["dependsOn"], ["O1", "D1"])
        self.assertEqual(activities["C2"]["dependsOn"], ["C1"])
        self.assertIn("AWS", catalog()["lockedDecisions"]["cloud"])

    def test_prompt_names_activity_and_forbids_src(self) -> None:
        activities = {item["id"]: item for item in catalog()["activities"]}
        prompt = p_back_next.agent_prompt(activities["R1"], catalog())
        self.assertIn("R1", prompt)
        self.assertIn("editar src/", prompt)
        self.assertIn("cursor/p-back-r1-9103", prompt)


if __name__ == "__main__":
    unittest.main()
