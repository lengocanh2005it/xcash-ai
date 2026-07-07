# Domain Docs

How the engineering skills should consume this repo's domain documentation when exploring the codebase.

**Layout: single-context.** This repo does not use the generic `CONTEXT.md` / `docs/adr/` convention — it already has its own domain-doc system under `agent-docs/`, which plays the same role.

## Before exploring, read these

- **[`agent-docs/00-current-state.md`](../../agent-docs/00-current-state.md)** — always read first. Snapshot of actual repo state (real file tree, real scripts, real dependencies, what's done/not done). Usually enough to know the next step without re-exploring with `find`/`grep`/`ls`.
- **[`agent-docs/reference/`](../../agent-docs/reference/)** — plays the role of `CONTEXT.md`: the source of truth for business logic (business overview, RBAC, DB schema, UI spec, sprint plan). Read the relevant reference doc before inferring business behavior.
  - [`reference/business-overview.md`](../../agent-docs/reference/business-overview.md) — domain overview, webhook flows.
  - [`reference/rbac.md`](../../agent-docs/reference/rbac.md) — 4-role RBAC permission matrix.
  - Other files under `reference/` for DB schema, UI spec, sprint plan — see [`agent-docs/README.md`](../../agent-docs/README.md) for the full index.
- **ADRs**: this repo has no dedicated `docs/adr/` yet. Architectural decisions are folded into `agent-docs/00-current-state.md` and the relevant `reference/` doc instead. If a decision doesn't fit either, note it as a gap rather than inventing a `docs/adr/` directory the repo doesn't use.

If any of these files don't exist, **proceed silently**. Don't flag their absence; don't suggest creating them upfront.

## Use the glossary's vocabulary

When your output names a domain concept (in an issue title, a refactor proposal, a hypothesis, a test name), use the term as defined in `agent-docs/reference/`. Key terms already fixed by this repo — don't drift to synonyms:

- **Cas Balance Hook** — `POST /api/v1/webhook/cas`, business-side webhook, routed by `grantId`. Not to be confused with **PayOS billing webhook** — `POST /api/v1/webhook/payos-billing`, routed by `orderCode`.
- **TT133** — Thông tư 133/2016/TT-BTC accounting standard for SMEs (~60–70 accounts), the classification target.
- **Human Review** — the accountant confirmation queue for transactions below the 85% confidence threshold.
- Four RBAC roles: `cas_partner` (system-level, `tenant_id = NULL`), `admin`, `accountant`, `viewer`.

If the concept you need isn't in `agent-docs/reference/` yet, that's a signal — either you're inventing language the project doesn't use (reconsider) or there's a real gap (note it, and flag that `agent-docs/` may need a sync per [`.claude/skills/sync-agent-docs/SKILL.md`](../../.claude/skills/sync-agent-docs/SKILL.md)).

## Flag conflicts

If your output contradicts what's documented in `agent-docs/reference/` or `agent-docs/00-current-state.md`, surface it explicitly rather than silently overriding:

> _Contradicts `reference/rbac.md` — but worth reopening because…_
