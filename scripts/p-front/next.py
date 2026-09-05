#!/usr/bin/env python3
"""Pick the next unblocked P-front activity from git history and open PRs.

Done  = commit on origin/main whose subject contains "[P-front] <ID>"
Busy  = open PR whose title contains "[P-front] <ID>"
Next  = first activity whose dependsOn are all done and which is not done/busy

Usage:
  python3 scripts/p-front/next.py
  python3 scripts/p-front/next.py --json
  python3 scripts/p-front/next.py --prompt
"""

from __future__ import annotations

import argparse
import json
import subprocess
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
ACTIVITIES_PATH = Path(__file__).resolve().parent / "activities.json"


def run(args: list[str]) -> str:
    result = subprocess.run(args, cwd=ROOT, text=True, capture_output=True)
    if result.returncode != 0:
        return ""
    return result.stdout


def load_catalog() -> dict:
    return json.loads(ACTIVITIES_PATH.read_text(encoding="utf-8"))


def marker(activity_id: str) -> str:
    return f"[P-front] {activity_id}"


def done_ids() -> set[str]:
    log = run(["git", "log", "origin/main", "--pretty=%s"])
    found: set[str] = set()
    catalog = load_catalog()
    for activity in catalog["activities"]:
        if marker(activity["id"]) in log:
            found.add(activity["id"])
    return found


def busy_ids() -> dict[str, str]:
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
    busy: dict[str, str] = {}
    if not raw.strip():
        return busy
    try:
        prs = json.loads(raw)
    except json.JSONDecodeError:
        return busy
    catalog = load_catalog()
    for activity in catalog["activities"]:
        token = marker(activity["id"])
        for pr in prs:
            title = pr.get("title") or ""
            if token in title:
                busy[activity["id"]] = pr.get("url") or f"#{pr.get('number')}"
    return busy


def select_next(catalog: dict, done: set[str], busy: dict[str, str]) -> list[dict]:
    ready: list[dict] = []
    for activity in catalog["activities"]:
        activity_id = activity["id"]
        if activity_id in done or activity_id in busy:
            continue
        deps = set(activity.get("dependsOn") or [])
        if deps <= done:
            ready.append(activity)
    return ready


def agent_prompt(activity: dict, catalog: dict) -> str:
    owner = "\n".join(f"- {path}" for path in activity.get("ownerFiles") or ["(see sprint doc)"])
    acceptance = "\n".join(f"- {item}" for item in activity.get("acceptance") or [])
    verify = "\n".join(f"- `{cmd}`" for cmd in activity.get("verify") or [])
    return f"""Execute SOMENTE a atividade {activity["id"]} — {activity["title"]}.

Obrigatório ler, nesta ordem:
1. AGENTS.md
2. docs/agents/README.md
3. docs/agents/roles.md
4. docs/agents/context-policy.md
5. docs/agents/decision-policy.md
6. docs/agents/execution-protocol.md
7. docs/architecture/domain-invariants.md
8. docs/frontend-sprint.md
9. docs/agents/p-front-orchestrator.md
10. só os arquivos do escopo abaixo

Decisões travadas:
- {catalog["lockedDecisions"]["brand"]}
- {catalog["lockedDecisions"]["visual"]}
- {catalog["lockedDecisions"]["seller"]}

Arquivos desta atividade:
{owner}

Não pode:
- editar server/
- nova rota, endpoint, campo ou feature
- enfraquecer auth, CORS, rate limit ou testes
- começar outra atividade no mesmo PR

Critérios de aceite:
{acceptance}

Verificação:
{verify}

Branch: cursor/p-front-{activity["id"].lower().replace(".", "")}-ef90
Título do PR: [P-front] {activity["id"]} — {activity["title"]}
PR draft até Verification PASS. Não mergear. Não fechar issue.
Handoff no formato docs/agents/handoff-template.md.
Parar quando os critérios de aceite estiverem provados.
"""


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--json", action="store_true")
    parser.add_argument("--prompt", action="store_true")
    args = parser.parse_args()

    catalog = load_catalog()
    done = done_ids()
    busy = busy_ids()
    ready = select_next(catalog, done, busy)

    payload = {
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
        "next": ready[0] if ready else None,
        "complete": not ready and len(done) == len(catalog["activities"]),
    }

    if args.json:
        json.dump(payload, sys.stdout, indent=2, ensure_ascii=False)
        sys.stdout.write("\n")
        return 0

    if payload["complete"]:
        print("P-front complete. No remaining activities.")
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
