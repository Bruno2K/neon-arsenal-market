#!/usr/bin/env python3
"""Pick the next unblocked P-back activity from git history and open PRs.

Done  = legacyDone, or a commit on origin/main whose subject contains a done marker
        (default "[P-back] <ID>")
Busy  = open PR whose title contains a busy marker (default "[P-back] <ID>")
Next  = first activity whose dependsOn are all done and which is not done/busy

Usage:
  python3 scripts/p-back/next.py
  python3 scripts/p-back/next.py --json
  python3 scripts/p-back/next.py --prompt
"""

from __future__ import annotations

import argparse
import json
import subprocess
import sys
from pathlib import Path
from typing import Any

ROOT = Path(__file__).resolve().parents[2]
ACTIVITIES_PATH = Path(__file__).resolve().parent / "activities.json"


def run(args: list[str]) -> str:
    result = subprocess.run(args, cwd=ROOT, text=True, capture_output=True)
    if result.returncode != 0:
        return ""
    return result.stdout


def load_catalog() -> dict[str, Any]:
    return json.loads(ACTIVITIES_PATH.read_text(encoding="utf-8"))


def default_marker(activity_id: str) -> str:
    return f"[P-back] {activity_id}"


def done_markers_for(activity: dict[str, Any]) -> list[str]:
    markers = activity.get("doneMarkers")
    if markers:
        return list(markers)
    return [default_marker(activity["id"])]


def busy_markers_for(activity: dict[str, Any]) -> list[str]:
    markers = activity.get("busyMarkers")
    if markers:
        return list(markers)
    return [default_marker(activity["id"])]


def activity_is_done(activity: dict[str, Any], log: str) -> bool:
    if activity.get("legacyDone"):
        return True
    return any(marker in log for marker in done_markers_for(activity))


def activity_busy_url(
    activity: dict[str, Any], prs: list[dict[str, Any]]
) -> str | None:
    markers = busy_markers_for(activity)
    for pr in prs:
        title = pr.get("title") or ""
        if any(marker in title for marker in markers):
            return pr.get("url") or f"#{pr.get('number')}"
    return None


def done_ids(catalog: dict[str, Any], log: str) -> set[str]:
    found: set[str] = set()
    for activity in catalog["activities"]:
        if activity_is_done(activity, log):
            found.add(activity["id"])
    return found


def busy_ids(
    catalog: dict[str, Any], prs: list[dict[str, Any]]
) -> dict[str, str]:
    busy: dict[str, str] = {}
    for activity in catalog["activities"]:
        url = activity_busy_url(activity, prs)
        if url:
            busy[activity["id"]] = url
    return busy


def select_next(
    catalog: dict[str, Any], done: set[str], busy: dict[str, str]
) -> list[dict[str, Any]]:
    ready: list[dict[str, Any]] = []
    for activity in catalog["activities"]:
        activity_id = activity["id"]
        if activity_id in done or activity_id in busy:
            continue
        deps = set(activity.get("dependsOn") or [])
        if deps <= done:
            ready.append(activity)
    return ready


def fetch_commit_log() -> str:
    return run(["git", "log", "origin/main", "--pretty=%s"])


def fetch_open_prs() -> list[dict[str, Any]]:
    raw = run(
        [
            "gh",
            "pr",
            "list",
            "--state",
            "open",
            "--limit",
            "50",
            "--json",
            "title,url,number",
        ]
    )
    if not raw.strip():
        return []
    try:
        parsed = json.loads(raw)
    except json.JSONDecodeError:
        return []
    if not isinstance(parsed, list):
        return []
    return parsed


def agent_prompt(activity: dict[str, Any], catalog: dict[str, Any]) -> str:
    owner = "\n".join(
        f"- {path}" for path in activity.get("ownerFiles") or ["(see sprint doc)"]
    )
    acceptance = "\n".join(f"- {item}" for item in activity.get("acceptance") or [])
    verify = "\n".join(f"- `{cmd}`" for cmd in activity.get("verify") or [])
    locked = catalog.get("lockedDecisions") or {}
    branch_id = activity["id"].lower().replace(".", "")
    return f"""Execute SOMENTE a atividade {activity["id"]} — {activity["title"]}.

Obrigatório ler, nesta ordem:
1. AGENTS.md
2. docs/agents/README.md
3. docs/agents/roles.md
4. docs/agents/context-policy.md
5. docs/agents/decision-policy.md
6. docs/agents/execution-protocol.md
7. docs/architecture/domain-invariants.md
8. docs/backend-sprint.md
9. docs/agents/p-back-orchestrator.md
10. só os arquivos do escopo abaixo

Decisões travadas:
- {locked.get("architecture", "")}
- {locked.get("payments", "")}
- {locked.get("cloud", "")}

Arquivos desta atividade:
{owner}

Não pode:
- editar arquivos fora de ownerFiles
- editar src/ ou scripts/p-front/ (P-front)
- começar AWS/Terraform a menos que a atividade seja C2 e o ADR C1 tenha escolhido AWS
- inventar API PayPal, refund ou variável de ambiente
- introduzir Redis, Kafka, SQS ou microsserviços
- enfraquecer auth, CORS, rate limit ou testes
- começar outra atividade no mesmo PR

Critérios de aceite:
{acceptance}

Verificação:
{verify}

Branch: cursor/p-back-{branch_id}-9103
Título do PR: [P-back] {activity["id"]} — {activity["title"]}
PR draft até Verification PASS. Não mergear. Não fechar issue.
Handoff no formato docs/agents/handoff-template.md.
Parar quando os critérios de aceite estiverem provados.
"""


def build_payload(
    catalog: dict[str, Any], done: set[str], busy: dict[str, str]
) -> dict[str, Any]:
    ready = select_next(catalog, done, busy)
    return {
        "done": sorted(done),
        "inProgress": busy,
        "ready": [
            {
                "id": item["id"],
                "title": item["title"],
                "parallelGroup": item.get("parallelGroup"),
            }
            for item in ready
        ],
        "next": (
            {
                "id": ready[0]["id"],
                "title": ready[0]["title"],
                "parallelGroup": ready[0].get("parallelGroup"),
            }
            if ready
            else None
        ),
        "complete": not ready and not busy and len(done) == len(catalog["activities"]),
    }


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--json", action="store_true")
    parser.add_argument("--prompt", action="store_true")
    args = parser.parse_args()

    catalog = load_catalog()
    done = done_ids(catalog, fetch_commit_log())
    busy = busy_ids(catalog, fetch_open_prs())
    payload = build_payload(catalog, done, busy)
    ready = select_next(catalog, done, busy)

    if args.json:
        json.dump(payload, sys.stdout, indent=2, ensure_ascii=False)
        sys.stdout.write("\n")
        return 0

    if payload["complete"]:
        print("P-back complete. No remaining activities.")
        return 0

    if not ready:
        print("No unblocked activity. Waiting on in-progress work:")
        for activity_id, url in busy.items():
            print(f"  {activity_id}: {url}")
        return 2

    nxt = ready[0]
    if args.prompt:
        sys.stdout.write(agent_prompt(nxt, catalog))
        return 0

    print(f"next: {nxt['id']} — {nxt['title']}")
    if len(ready) > 1:
        extras = ", ".join(f"{item['id']} ({item['title']})" for item in ready[1:])
        print(f"also unblocked (parallel if files are disjoint): {extras}")
    if done:
        print("done: " + ", ".join(sorted(done)))
    if busy:
        print("in progress: " + ", ".join(f"{k}={v}" for k, v in busy.items()))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
