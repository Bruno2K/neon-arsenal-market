#!/usr/bin/env python3
"""Optional: create GitHub issues from scripts/p-back/activities.json.

This Cloud Agent cannot create issues (gh is read-only here).
Run on a machine with write access:

  python3 scripts/p-back/create-issues.py --dry-run
  python3 scripts/p-back/create-issues.py

Idempotent: skips an activity if an open or closed issue already
has "[P-back] <ID>" in the title. Skips legacyDone historical items.
"""

from __future__ import annotations

import argparse
import json
import subprocess
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
ACTIVITIES_PATH = Path(__file__).resolve().parent / "activities.json"


def run(args: list[str]) -> subprocess.CompletedProcess[str]:
    return subprocess.run(args, cwd=ROOT, text=True, capture_output=True)


def existing_titles() -> set[str]:
    result = run(
        [
            "gh",
            "issue",
            "list",
            "--state",
            "all",
            "--limit",
            "200",
            "--json",
            "title",
        ]
    )
    if result.returncode != 0:
        raise SystemExit(result.stderr or "gh issue list failed")
    return {item["title"] for item in json.loads(result.stdout)}


def issue_body(activity: dict, catalog: dict) -> str:
    deps = ", ".join(activity.get("dependsOn") or []) or "none"
    files = "\n".join(f"- `{path}`" for path in activity.get("ownerFiles") or [])
    acceptance = "\n".join(f"- [ ] {item}" for item in activity.get("acceptance") or [])
    verify = "\n".join(f"- `{cmd}`" for cmd in activity.get("verify") or [])
    roles = ", ".join(activity.get("roles") or [])
    locked = catalog.get("lockedDecisions") or {}
    return f"""## Objective
{activity["title"]}

## Sprint
P-back. Source of truth: `docs/backend-sprint.md` and `scripts/p-back/activities.json`.
Prefer the orchestrator (`python3 scripts/p-back/next.py`) over hand-picking issues.

## Locked decisions
- {locked.get("architecture", "")}
- {locked.get("payments", "")}
- {locked.get("cloud", "")}

## Depends on
{deps}

## Scope files
{files or "- (see sprint doc)"}

## Out of scope
- `src/`
- `docs/frontend-sprint.md`
- `scripts/p-front/`
- AWS/Terraform unless this activity is C2 and C1 selected AWS
- Inventing PayPal APIs, refunds, or environment variables

## Acceptance criteria
{acceptance}

## Verify
{verify}

## Required review
{roles}
"""


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--dry-run", action="store_true")
    parser.add_argument("--label", default="enhancement")
    args = parser.parse_args()

    catalog = json.loads(ACTIVITIES_PATH.read_text(encoding="utf-8"))
    titles = existing_titles() if not args.dry_run else set()
    created = 0
    skipped = 0

    parent_title = "[P-back] Backend sprint — reliability before cloud"
    if parent_title not in titles and not args.dry_run:
        locked = catalog.get("lockedDecisions") or {}
        body = f"""## Objective
Execute remaining backend production-maturity work with a deterministic next-activity loop.

## Execution
Do not paste activities by hand. After this issue exists, agents run:

```text
python3 scripts/p-back/next.py --prompt
```

and implement only the printed activity.

## Locked decisions
- {locked.get("architecture", "")}
- {locked.get("payments", "")}
- {locked.get("cloud", "")}

## Source of truth
- `docs/backend-sprint.md`
- `docs/agents/p-back-orchestrator.md`
- `scripts/p-back/activities.json`
"""
        result = run(
            [
                "gh",
                "issue",
                "create",
                "--title",
                parent_title,
                "--body",
                body,
                "--label",
                args.label,
            ]
        )
        if result.returncode != 0:
            print(result.stderr, file=sys.stderr)
            return result.returncode
        print(result.stdout.strip())
        created += 1
    else:
        skipped += 1
        print(f"skip parent ({'exists' if parent_title in titles else 'dry-run'})")

    for activity in catalog["activities"]:
        if activity.get("legacyDone"):
            print(f"skip {activity['id']} (legacyDone)")
            skipped += 1
            continue
        title = f"[P-back] {activity['id']} — {activity['title']}"
        if title in titles:
            print(f"skip {activity['id']} (exists)")
            skipped += 1
            continue
        body = issue_body(activity, catalog)
        if args.dry_run:
            print(f"dry-run {title}")
            skipped += 1
            continue
        result = run(
            [
                "gh",
                "issue",
                "create",
                "--title",
                title,
                "--body",
                body,
                "--label",
                args.label,
            ]
        )
        if result.returncode != 0:
            print(result.stderr, file=sys.stderr)
            return result.returncode
        print(result.stdout.strip())
        created += 1

    print(f"created={created} skipped={skipped}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
