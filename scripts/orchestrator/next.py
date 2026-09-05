#!/usr/bin/env python3
"""Unified engineering orchestrator.

Intake is open GitHub issues, not p-front/p-back activity JSON files.

The CLI classifies issues, selects a disjoint work set, assigns roles from
docs/agents/roles.md, and prints Task-subagent prompts. The parent Cursor
agent must spawn those subagents and must not implement the issues itself.

Usage:
  python3 scripts/orchestrator/next.py
  python3 scripts/orchestrator/next.py --json
  python3 scripts/orchestrator/next.py --prompt
  python3 scripts/orchestrator/next.py --track backend
  python3 scripts/orchestrator/next.py --issue 82
"""

from __future__ import annotations

import argparse
import json
import re
import subprocess
import sys
import unicodedata
from dataclasses import dataclass
from pathlib import Path
from typing import Any

ROOT = Path(__file__).resolve().parents[2]
ADR_CLOUD = ROOT / "docs/adr/0007-cloud-target-render.md"

FRONTEND_TITLE_PREFIXES = (
    "[frontend]",
    "[ux]",
    "[product]",
    "[accessibility]",
    "[analytics]",
)
PROBE_TITLE = re.compile(
    r"probe|do-not-keep|ux-audit-probe|test-write", re.IGNORECASE
)
ISSUE_REF = re.compile(r"(?<!\d)#(\d+)(?!\d)")
DEPENDS_LINE = re.compile(
    r"(?i)(?:depends?\s+on|depend[eê]ncias?|blocked\s+by)\s*[:\-]?\s*(.*)"
)
PRIORITY_LABEL = re.compile(r"(?i)^(?:priority:)?p([0-3])$")
CLOSES_REF = re.compile(
    r"(?i)(?:fix(?:es)?|close[sd]?|resolve[sd]?)\s+#(\d+)"
)

FRONTEND_CORRECTNESS = (
    "idempotency",
    "idempotency-key",
    "paypal",
    "reserva",
    "reservation",
    "checkout",
    "auth",
    "login",
    "token",
    "pagamento",
)
TOKEN_CANON = {
    "pagamento": "payment",
    "pagamentos": "payment",
    "payment": "payment",
    "idempotencia": "idempotency",
    "idempotente": "idempotency",
    "idempotency": "idempotency",
    "ameaca": "threat",
    "threat": "threat",
    "diagramas": "c4",
    "diagrama": "c4",
    "c4": "c4",
}

LOCKED_BACKEND = (
    "Modular monolith. PostgreSQL is the source of truth. Do not add Redis, Kafka, RabbitMQ, SQS, or microservices.",
    "Do not invent PayPal APIs, refunds, or environment variables. OrdersCreate and OrdersCapture are not retried.",
    "Render is current production (render.yaml, ADR 0007). Do not implement AWS/Terraform unless a later ADR supersedes 0007 and selects AWS.",
)
LOCKED_FRONTEND = (
    "Neon Arsenal. Remove SKINMARKET / SkinMarket / “CS2 Skin Marketplace”.",
    "Dark editorial. No neon glow, scan-lines, grid-pattern, or global uppercase headings.",
    "Keep /seller/products and /seller/listings. Listings = unique-item CRUD. Products = read-only Product catalog via listProducts unless the GitHub issue explicitly uses an existing ADMIN API.",
    "Do not invent endpoints, env vars, or payment/reservation semantics. Use APIs already documented in the GitHub issue or OpenAPI. Brand/visual locks in docs/frontend-sprint.md still apply; the F0 feature freeze does not block a GitHub issue that uses an existing API.",
)


@dataclass(frozen=True)
class Issue:
    number: int
    title: str
    body: str
    url: str
    labels: tuple[str, ...]
    state: str = "OPEN"


@dataclass(frozen=True)
class PullRequest:
    number: int
    title: str
    url: str
    body: str


@dataclass(frozen=True)
class Classified:
    issue: Issue
    track: str
    priority: str
    priority_rank: int
    roles: tuple[str, ...]
    primary_role: str
    depends_on: tuple[int, ...]
    correctness: bool
    forbidden: tuple[str, ...]
    skip_reason: str | None = None
    gate_reason: str | None = None
    likely_done_subject: str | None = None
    busy_url: str | None = None


def run(args: list[str], cwd: Path | None = None) -> str:
    result = subprocess.run(
        args, cwd=cwd or ROOT, text=True, capture_output=True
    )
    if result.returncode != 0:
        return ""
    return result.stdout


def run_json_list(args: list[str]) -> list[Any] | None:
    result = subprocess.run(args, cwd=ROOT, text=True, capture_output=True)
    if result.returncode != 0:
        return None
    raw = result.stdout.strip()
    if not raw:
        return []
    try:
        parsed = json.loads(raw)
    except json.JSONDecodeError:
        return None
    if not isinstance(parsed, list):
        return None
    return parsed


def label_names(raw: Any) -> tuple[str, ...]:
    names: list[str] = []
    if not isinstance(raw, list):
        return ()
    for item in raw:
        if isinstance(item, str):
            names.append(item)
        elif isinstance(item, dict) and item.get("name"):
            names.append(str(item["name"]))
    return tuple(names)


def parse_issue(raw: dict[str, Any]) -> Issue:
    return Issue(
        number=int(raw["number"]),
        title=str(raw.get("title") or ""),
        body=str(raw.get("body") or ""),
        url=str(raw.get("url") or f"#{raw.get('number')}"),
        labels=label_names(raw.get("labels")),
        state=str(raw.get("state") or "OPEN").upper(),
    )


def parse_pr(raw: dict[str, Any]) -> PullRequest:
    return PullRequest(
        number=int(raw.get("number") or 0),
        title=str(raw.get("title") or ""),
        url=str(raw.get("url") or f"#{raw.get('number')}"),
        body=str(raw.get("body") or ""),
    )


def fetch_open_issues() -> list[Issue] | None:
    parsed = run_json_list(
        [
            "gh",
            "issue",
            "list",
            "--state",
            "open",
            "--limit",
            "200",
            "--json",
            "number,title,body,labels,url,state",
        ]
    )
    if parsed is None:
        return None
    return [parse_issue(item) for item in parsed if isinstance(item, dict)]


def fetch_open_prs() -> list[PullRequest]:
    parsed = run_json_list(
        [
            "gh",
            "pr",
            "list",
            "--state",
            "open",
            "--limit",
            "50",
            "--json",
            "number,title,url,body",
        ]
    )
    if not parsed:
        return []
    return [parse_pr(item) for item in parsed if isinstance(item, dict)]


def fetch_commit_subjects() -> list[str]:
    log = run(["git", "log", "origin/main", "--pretty=%s", "-n", "250"])
    return [line.strip() for line in log.splitlines() if line.strip()]


def aws_work_allowed(root: Path = ROOT) -> bool:
    if not ADR_CLOUD.exists() and root == ROOT:
        return False
    path = root / "docs/adr/0007-cloud-target-render.md"
    if not path.exists():
        return False
    text = path.read_text(encoding="utf-8")
    if "Current production target is Render" in text:
        return False
    return "production target is AWS" in text or "selects AWS as the production target" in text


def fold_accents(value: str) -> str:
    normalized = unicodedata.normalize("NFD", value)
    return "".join(char for char in normalized if unicodedata.category(char) != "Mn")


def title_tokens(value: str) -> tuple[str, ...]:
    text = fold_accents(value).lower()
    text = re.sub(r"\[(.*?)\]", " ", text)
    text = re.sub(r"^(p[0-3](?:\.\d+)?|p-back|p-front)\s*[—:\-]\s*", "", text)
    text = re.sub(r"[^a-z0-9]+", " ", text)
    stop = {
        "the",
        "and",
        "for",
        "with",
        "from",
        "para",
        "com",
        "uma",
        "dos",
        "das",
        "criar",
        "implementar",
        "adicionar",
        "tornar",
    }
    tokens = [tok for tok in text.split() if len(tok) > 2 and tok not in stop]
    return tuple(TOKEN_CANON.get(tok, tok) for tok in tokens)


def title_key(value: str) -> str:
    return " ".join(title_tokens(value))


def likely_done_subject(
    title: str, subjects: list[str], min_jaccard: float = 0.45
) -> str | None:
    left = set(title_tokens(title))
    if len(left) < 3:
        return None
    best_subject: str | None = None
    best = 0.0
    for subject in subjects:
        right = set(title_tokens(subject))
        if len(right) < 2:
            continue
        shared = left & right
        if len(shared) < 2:
            continue
        score = len(shared) / len(left | right)
        if score > best:
            best = score
            best_subject = subject
    if best >= min_jaccard and best_subject:
        return best_subject
    return None


def parse_depends_on(body: str) -> tuple[int, ...]:
    found: list[int] = []
    for line in (body or "").splitlines():
        match = DEPENDS_LINE.search(line)
        if not match:
            continue
        for number in ISSUE_REF.findall(match.group(1) or ""):
            found.append(int(number))
    return tuple(dict.fromkeys(found))


def issue_mentioned(text: str, number: int) -> bool:
    return re.search(rf"(?<!\d)#{number}(?!\d)", text or "") is not None


def busy_url_for(issue: Issue, prs: list[PullRequest]) -> str | None:
    for pr in prs:
        blob = f"{pr.title}\n{pr.body}"
        if issue_mentioned(blob, issue.number):
            return pr.url
        if CLOSES_REF.search(blob) and issue_mentioned(blob, issue.number):
            return pr.url
        title_core = title_key(issue.title)
        if title_core and title_core in title_key(pr.title) and len(title_core) > 16:
            return pr.url
    return None


def detect_track(issue: Issue) -> str:
    labels = {name.lower() for name in issue.labels}
    title = issue.title.lower()
    if any(title.startswith(prefix) for prefix in FRONTEND_TITLE_PREFIXES):
        return "frontend"
    if "frontend" in labels or "ux" in labels:
        return "frontend"
    if labels & {
        "backend",
        "payments",
        "orders",
        "database",
        "infrastructure",
        "aws",
        "terraform",
        "ci",
        "docker",
        "observability",
        "reliability",
        "authentication",
        "api",
        "domain",
        "concurrency",
    }:
        return "backend"
    if re.match(r"^p[0-3](?:\.\d+)?\b", title):
        return "backend"
    body = (issue.body or "").lower()
    src_hits = body.count("`src/") + body.count("src/")
    server_hits = body.count("`server/") + body.count("server/")
    if src_hits > server_hits and src_hits > 0:
        return "frontend"
    return "backend"


def detect_priority(issue: Issue) -> tuple[str, int]:
    for name in issue.labels:
        match = PRIORITY_LABEL.match(name.strip())
        if match:
            rank = int(match.group(1))
            return f"P{rank}", rank
    match = re.match(r"^p([0-3])(?:\.\d+)?\b", issue.title.strip(), re.IGNORECASE)
    if match:
        rank = int(match.group(1))
        return f"P{rank}", rank
    return "P3", 3


def is_frontend_correctness(issue: Issue) -> bool:
    blob = f"{issue.title}\n{issue.body}".lower()
    return any(term in blob for term in FRONTEND_CORRECTNESS)


def select_roles(issue: Issue, track: str) -> tuple[str, ...]:
    labels = {name.lower() for name in issue.labels}
    blob = f"{issue.title}\n{issue.body}".lower()

    if track == "frontend":
        if any(term in blob for term in ("paypal", "checkout", "idempotency", "cart", "carrinho", "pagamento")):
            return ("Implementation", "Test", "Security", "Verification")
        if any(term in blob for term in ("auth", "login", "token", "register", "registro")):
            return ("Implementation", "Security", "Verification")
        if "test" in blob or "coverage" in blob:
            return ("Implementation", "Test", "Verification")
        return ("Implementation", "Verification")

    if labels & {"payments"} or any(
        term in blob for term in ("paypal", "webhook", "payment")
    ):
        return ("Backend", "Reliability", "Security", "Test", "Verification")
    if labels & {"concurrency", "orders", "database"} or any(
        term in blob
        for term in ("reserva", "reservation", "prisma", "schema", "transaction")
    ):
        return ("Backend", "Database/Concurrency", "Test", "Verification")
    if labels & {"security", "authentication"}:
        return ("Backend", "Security", "Test", "Verification")
    if labels & {"reliability"}:
        return ("Backend", "Reliability", "Test", "Verification")
    if labels & {"infrastructure", "aws", "terraform", "docker", "devops", "ci"}:
        return ("Planner", "Infra/Backend", "Security", "Reliability", "Verification")
    if labels & {"architecture"} and labels & {"documentation"}:
        return ("Planner", "Architecture", "Verification")
    if labels & {"architecture"}:
        return ("Planner", "Backend", "Architecture", "Test", "Verification")
    if labels & {"documentation"}:
        return ("Planner", "Verification")
    if labels & {"bug"} or "bug" in blob:
        return ("Backend", "Verification")
    if labels & {"api"}:
        return ("Backend", "Test", "Security", "Verification")
    return ("Backend", "Test", "Verification")


def forbidden_for(track: str) -> tuple[str, ...]:
    if track == "frontend":
        return ("server/", "server/prisma/")
    return ("src/",)


def gate_reason_for(issue: Issue, _track: str, aws_allowed: bool) -> str | None:
    labels = {name.lower() for name in issue.labels}
    title = issue.title.lower()
    if "redis" in labels or re.search(r"\bredis\b", title):
        return "Speculative Redis is forbidden until a measured bottleneck ADR exists."
    if any(term in title for term in ("kafka", "rabbitmq")) or re.search(
        r"\bsqs\b", title
    ):
        return "Speculative brokers/queues (Kafka, RabbitMQ, SQS) are forbidden."
    awsish = bool(labels & {"aws", "terraform"}) or any(
        term in title for term in ("terraform", "ecs", "secrets manager", "cloudwatch")
    )
    if awsish and not aws_allowed:
        return "ADR 0007 keeps Render. Do not implement AWS/Terraform."
    return None


def classify_issue(
    issue: Issue,
    *,
    subjects: list[str],
    prs: list[PullRequest],
    aws_allowed: bool,
) -> Classified:
    if PROBE_TITLE.search(issue.title):
        return Classified(
            issue=issue,
            track="skip",
            priority="P3",
            priority_rank=9,
            roles=(),
            primary_role="",
            depends_on=(),
            correctness=False,
            forbidden=(),
            skip_reason="probe/test issue",
        )
    track = detect_track(issue)
    priority, rank = detect_priority(issue)
    correctness = track == "backend" and rank <= 1 or (
        track == "frontend" and is_frontend_correctness(issue)
    )
    if track == "frontend" and correctness and rank > 1:
        priority, rank = "P1", 1
    roles = select_roles(issue, track)
    return Classified(
        issue=issue,
        track=track,
        priority=priority,
        priority_rank=rank,
        roles=roles,
        primary_role=roles[0] if roles else "",
        depends_on=parse_depends_on(issue.body),
        correctness=correctness,
        forbidden=forbidden_for(track),
        gate_reason=gate_reason_for(issue, track, aws_allowed),
        likely_done_subject=likely_done_subject(issue.title, subjects),
        busy_url=busy_url_for(issue, prs),
    )


def deps_satisfied(item: Classified, open_numbers: set[int]) -> bool:
    return all(dep not in open_numbers for dep in item.depends_on)


def sort_key(item: Classified) -> tuple[int, int, int]:
    correctness_penalty = 0 if item.correctness else 1
    return (item.priority_rank, correctness_penalty, item.issue.number)


def select_spawn(
    classified: list[Classified],
    *,
    track: str,
    limit: int,
    issue_number: int | None,
) -> list[Classified]:
    open_numbers = {
        item.issue.number
        for item in classified
        if item.issue.state == "OPEN" and not item.skip_reason
    }
    if issue_number is not None:
        chosen = [item for item in classified if item.issue.number == issue_number]
        return chosen[:1]

    eligible: list[Classified] = []
    for item in classified:
        if item.skip_reason or item.gate_reason or item.likely_done_subject:
            continue
        if item.busy_url:
            continue
        if item.track not in {"backend", "frontend"}:
            continue
        if track != "all" and item.track != track:
            continue
        if not deps_satisfied(item, open_numbers):
            continue
        eligible.append(item)

    eligible.sort(key=sort_key)
    spawn: list[Classified] = []
    used_tracks: set[str] = set()
    for item in eligible:
        if item.track in used_tracks:
            continue
        spawn.append(item)
        used_tracks.add(item.track)
        if len(spawn) >= limit:
            break
    return spawn


def slug(title: str) -> str:
    text = title_key(title).replace(" ", "-")
    text = re.sub(r"-+", "-", text).strip("-")
    return (text[:36].strip("-") or "issue")


def branch_for(item: Classified) -> str:
    return f"cursor/issue-{item.issue.number}-{slug(item.issue.title)}"


def verify_commands(item: Classified) -> tuple[str, ...]:
    if item.track == "frontend":
        return ("npm run typecheck", "npm run lint", "npm test")
    if "payments" in {name.lower() for name in item.issue.labels} or "paypal" in item.issue.title.lower():
        return (
            "cd server && npx vitest run src/modules/payments/__tests__/payments.service.test.ts",
            "cd server && npm run test:integration",
        )
    if "Test" in item.roles:
        return ("cd server && npm run test:unit", "cd server && npm run test:integration")
    return ("cd server && npm run test:unit",)


def agent_prompt(item: Classified) -> str:
    locked = LOCKED_FRONTEND if item.track == "frontend" else LOCKED_BACKEND
    locked_txt = "\n".join(f"- {line}" for line in locked)
    roles_txt = ", ".join(item.roles)
    owner = "`src/`" if item.track == "frontend" else "`server/`"
    forbidden = "\n".join(f"- `{path}`" for path in item.forbidden)
    verify = "\n".join(f"- `{cmd}`" for cmd in verify_commands(item))
    body = (item.issue.body or "").strip() or "(empty issue body — stop and ask HUMAN if acceptance is unclear)"
    if len(body) > 4000:
        body = body[:4000] + "\n…[truncated]"
    return f"""You are a Cursor subagent for Neon Arsenal Market.
Assigned primary role: {item.primary_role}
Required roles (execute sequentially, do not skip Verification): {roles_txt}

Implement ONLY GitHub issue #{item.issue.number} — {item.issue.title}
URL: {item.issue.url}

Mandatory reading, in order:
1. AGENTS.md
2. .cursor/rules/ (00 through 06)
3. docs/agents/README.md
4. docs/agents/roles.md — you are the {item.primary_role} role
5. docs/agents/context-policy.md
6. docs/agents/decision-policy.md
7. docs/agents/execution-protocol.md
8. docs/agents/orchestrator.md
9. docs/architecture/domain-invariants.md
10. the GitHub issue body below
11. only the source, schema, tests, and docs required by this issue

Locked decisions:
{locked_txt}

Track: {item.track}
Owner tree: {owner}
Do not edit:
{forbidden}

Issue body:
{body}

Rules:
- Follow .cursor/rules and AGENTS.md. Do not weaken auth, CORS, rate limits, or tests.
- Do not invent APIs, env vars, PayPal contracts, or infrastructure.
- If acceptance criteria already hold on origin/main, do not re-implement. Report DONE with evidence and stop.
- If the issue is ambiguous or hits docs/agents/decision-policy.md, transition to HUMAN.
- One issue, one branch, one PR. Do not start another issue.
- Do not merge. Do not close the GitHub issue (gh is read-only).
- Handoff: docs/agents/handoff-template.md

Verification:
{verify}

Branch: {branch_for(item)}
PR title: #{item.issue.number} — {item.issue.title}
PR draft until Verification PASS.
Stop when acceptance criteria are proven.
"""


def spawn_entry(item: Classified) -> dict[str, Any]:
    return {
        "issue": item.issue.number,
        "title": item.issue.title,
        "url": item.issue.url,
        "track": item.track,
        "priority": item.priority,
        "role": item.primary_role,
        "requiredRoles": list(item.roles),
        "subagentType": "generalPurpose",
        "isolation": "branch",
        "canParallelize": True,
        "branch": branch_for(item),
        "forbidden": list(item.forbidden),
        "verify": list(verify_commands(item)),
        "description": f"{item.primary_role} #{item.issue.number}",
        "prompt": agent_prompt(item),
    }


def classified_summary(item: Classified) -> dict[str, Any]:
    return {
        "issue": item.issue.number,
        "title": item.issue.title,
        "url": item.issue.url,
        "track": item.track,
        "priority": item.priority,
        "role": item.primary_role,
        "roles": list(item.roles),
        "gate": item.gate_reason,
        "skip": item.skip_reason,
        "likelyDone": item.likely_done_subject,
        "busy": item.busy_url,
        "dependsOn": list(item.depends_on),
    }


def build_payload(
    classified: list[Classified],
    spawn: list[Classified],
) -> dict[str, Any]:
    blocked = [item for item in classified if item.gate_reason]
    likely_done = [item for item in classified if item.likely_done_subject]
    busy = [item for item in classified if item.busy_url]
    skipped = [item for item in classified if item.skip_reason]
    ready_unspawned = [
        item
        for item in classified
        if not item.skip_reason
        and not item.gate_reason
        and not item.likely_done_subject
        and not item.busy_url
        and item not in spawn
        and item.track in {"backend", "frontend"}
    ]
    return {
        "intake": "github-issues",
        "spawn": [spawn_entry(item) for item in spawn],
        "blocked": [classified_summary(item) for item in blocked],
        "likelyDone": [classified_summary(item) for item in likely_done],
        "inProgress": [classified_summary(item) for item in busy],
        "skipped": [classified_summary(item) for item in skipped],
        "readyUnspawned": [
            classified_summary(item) for item in sorted(ready_unspawned, key=sort_key)[:12]
        ],
        "complete": not spawn and not busy and not ready_unspawned,
        "parentMustSpawnSubagents": True,
        "parentMustNotImplement": True,
    }


def load_issues_from_path(path: Path) -> list[Issue]:
    parsed = json.loads(path.read_text(encoding="utf-8"))
    return [parse_issue(item) for item in parsed]


def load_prs_from_path(path: Path) -> list[PullRequest]:
    parsed = json.loads(path.read_text(encoding="utf-8"))
    return [parse_pr(item) for item in parsed]


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(
        description="Unified orchestrator: GitHub issues → role-assigned subagents"
    )
    parser.add_argument("--json", action="store_true")
    parser.add_argument("--prompt", action="store_true")
    parser.add_argument(
        "--track",
        choices=("all", "backend", "frontend"),
        default="all",
    )
    parser.add_argument("--issue", type=int)
    parser.add_argument("--limit", type=int, default=2)
    parser.add_argument("--issues-json", type=Path)
    parser.add_argument("--prs-json", type=Path)
    parser.add_argument("--subjects-json", type=Path)
    parser.add_argument("--aws-allowed", action="store_true")
    args = parser.parse_args(argv)

    if args.issues_json:
        issues = load_issues_from_path(args.issues_json)
    else:
        fetched = fetch_open_issues()
        if fetched is None:
            print(
                "Failed to list GitHub issues. Install/authenticate gh or pass --issues-json.",
                file=sys.stderr,
            )
            return 1
        issues = fetched

    if args.prs_json:
        prs = load_prs_from_path(args.prs_json)
    else:
        prs = fetch_open_prs()

    if args.subjects_json:
        subjects = json.loads(args.subjects_json.read_text(encoding="utf-8"))
    else:
        subjects = fetch_commit_subjects()

    aws_allowed = bool(args.aws_allowed) or aws_work_allowed()
    classified = [
        classify_issue(
            issue, subjects=subjects, prs=prs, aws_allowed=aws_allowed
        )
        for issue in issues
    ]
    spawn = select_spawn(
        classified,
        track=args.track,
        limit=max(1, args.limit),
        issue_number=args.issue,
    )
    payload = build_payload(classified, spawn)

    if args.json:
        json.dump(payload, sys.stdout, indent=2, ensure_ascii=False)
        sys.stdout.write("\n")
        return 0 if spawn or payload["complete"] else 2

    if args.prompt:
        if not spawn:
            print("No subagents to spawn.")
            return 2
        chunks = []
        for index, item in enumerate(spawn, start=1):
            header = (
                f"=== SUBAGENT {index}/{len(spawn)} — {item.primary_role} "
                f"— issue #{item.issue.number} ==="
            )
            chunks.append(header + "\n" + agent_prompt(item))
        sys.stdout.write("\n\n".join(chunks))
        if not chunks[-1].endswith("\n"):
            sys.stdout.write("\n")
        return 0

    if payload["complete"] and not spawn:
        print("Orchestrator complete. No eligible open GitHub issues.")
        return 0

    if not spawn:
        print("No unblocked GitHub issue to spawn. Waiting on blockers/in-progress:")
        for item in classified:
            if item.busy_url:
                print(f"  busy #{item.issue.number}: {item.busy_url}")
            elif item.gate_reason:
                print(f"  gated #{item.issue.number}: {item.gate_reason}")
        return 2

    print(
        f"orchestrator: spawn {len(spawn)} subagent(s) from GitHub issues "
        "(parent must Task-launch them; do not implement in the parent)"
    )
    for item in spawn:
        print(
            f"  #{item.issue.number} [{item.track}/{item.priority}] "
            f"{item.primary_role} — {item.issue.title}"
        )
        print(f"    roles: {', '.join(item.roles)}")
        print(f"    branch: {branch_for(item)}")
        print(f"    url: {item.issue.url}")
    likely_done = [item for item in classified if item.likely_done_subject]
    if likely_done:
        print("likely already on origin/main (not spawned):")
        for item in likely_done[:8]:
            print(f"  #{item.issue.number} ~ {item.likely_done_subject}")
    blocked = [item for item in classified if item.gate_reason]
    if blocked:
        print("gated (not spawned):")
        for item in blocked[:8]:
            print(f"  #{item.issue.number}: {item.gate_reason}")
    print("Prompts: python3 scripts/orchestrator/next.py --prompt")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
