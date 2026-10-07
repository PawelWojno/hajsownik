---
project: hajsownik
researched_at: 2026-10-07
recommended_platform: Cloudflare Workers
runner_up: Netlify
context_type: mvp
tech_stack:
  language: TypeScript
  framework: Astro 7 (React 19 islands)
  runtime: Cloudflare Workers (workerd)
---

## Recommendation

**Deploy on Cloudflare Workers.**

The project is already built on the official `@astrojs/cloudflare` adapter and `wrangler.jsonc` — Cloudflare is the only shortlisted platform requiring zero migration. It scores 5/5 Pass on the agent-friendly criteria, is effectively free at this project's scale (PRD `target_scale: users=small, qps=low`), and matches the developer's existing Cloudflare familiarity (interview P3). The anti-bias cross-check surfaced real risks (a non-prerendered-route rendering bug, CPU-time limits on bulk recurring-entry generation, the Worker's unchanged starter name), none severe enough to outweigh the zero-migration, zero-cost advantage for a 5-week, after-hours solo MVP.

This research was produced by adapting a prior, near-identical evaluation (same starter, same adapter, same auth shape) from a sibling project rather than re-running web research — platform capabilities don't change between apps on the same stack. Only the domain-specific risk analysis (Devil's Advocate / Pre-Mortem / Unknown Unknowns) and the two project-specific findings below were redone for Hajsownik specifically.

**Resolved stack discrepancy:** `context/foundation/tech-stack.md`'s `hints.deployment_target` still says `cloudflare-pages`, a stale value from the tech-stack-selection step. The project's actual, already-implemented configuration (`astro.config.mjs` adapter, `wrangler.jsonc`) targets Cloudflare **Workers**, not Pages — confirmed directly by reading both files, and the developer confirmed Workers as the explicit target for this research.

## Platform Comparison

Scored Pass/Partial/Fail against the five agent-friendly criteria (`references/agent-friendly-criteria.md`), weighted by interview answers: P1=no persistent connections needed, P2=minimize cost, P3=existing Cloudflare familiarity, P4=single region sufficient, P5=external providers (Supabase) fine.

| Platform           | CLI-first                            | Managed/Serverless | Agent-readable docs               | Stable deploy API | MCP/Integration                           | Total       |
| ------------------- | ------------------------------------- | ------------------- | ----------------------------------- | -------------------- | -------------------------------------------- | ------------- |
| Cloudflare Workers | Pass                                 | Pass               | Pass                              | Pass              | Pass                                      | 5 Pass      |
| Fly.io             | Pass                                 | Pass               | Pass                              | Pass              | Pass                                      | 5 Pass      |
| Vercel             | Pass                                 | Pass               | Partial                           | Pass              | Partial (MCP beta)                        | 3P/2Partial |
| Netlify            | Partial (rollback is dashboard-only) | Pass               | Pass                              | Partial           | Pass (GA MCP)                             | 3P/2Partial |
| Railway            | Partial                              | Pass               | Pass                              | Partial           | Partial (agent tooling new/preview-grade) | 2P/3Partial |
| Render             | Partial                              | Pass               | Partial (no docs-on-GitHub found) | Partial           | Partial (MCP maturity unlabeled)          | 1P/4Partial |

**Cloudflare Workers** — `wrangler` covers deploy/rollback/tail natively; docs are published as markdown/`llms.txt` explicitly for agents; D1/R2/KV/Queues are GA managed services; official MCP servers exist (docs + account management). Zero migration cost since the app is already built on this adapter.

**Fly.io** — ties Cloudflare on raw criteria, but the free tier was removed in 2024 and this repo has no Dockerfile today — real migration effort for a platform whose main advantage (persistent processes) this MVP doesn't need (interview P1 = No; the PRD's recurring expense/income model materializes entries upfront at definition time, not via an ongoing background process).

**Vercel** — solid technically, but the Hobby (free) tier's terms of service restrict commercial use, in tension with the "minimize cost" priority (interview P2) if the app is ever monetized or shared beyond personal use.

**Netlify** — GA MCP server and markdown docs are a genuine strength, but rollback requires the dashboard (no CLI rollback command), and the free tier switched to a credit-based pricing model in September 2025 that is harder to predict than Cloudflare's flat request-count-based free tier.

**Railway** — no permanent free tier (one-time trial credit only), agent/MCP tooling is newly launched and not yet GA-labeled.

**Render** — weakest overall: no confirmed docs-on-GitHub source, free tier spins down after 15 minutes of inactivity (cold starts would hurt the "save within 1 second" NFR on a cold request).

### Shortlisted Platforms

#### 1. Cloudflare Workers (Recommended)

Already implemented in this repo (`@astrojs/cloudflare`, `wrangler.jsonc`) — the only candidate with zero migration cost. 5/5 Pass on agent-friendly criteria. Free tier (100k requests/day) comfortably covers this MVP's small-scale, low-QPS traffic. Matches the developer's stated existing Cloudflare familiarity.

#### 2. Netlify

Strongest technical alternative: GA official MCP server, markdown-native docs, official `@astrojs/netlify` adapter (low-effort migration). Loses to Cloudflare on cost predictability (Sept 2025 credit-based free tier) and CLI completeness (no CLI rollback command — dashboard-only).

#### 3. Fly.io

The strongest "escape hatch" if a future version needs real persistent connections or WebSockets (explicitly out of scope today — PRD has no realtime/background-job requirements). Requires a new Dockerfile (none exists in this repo today) and a new adapter (`@astrojs/node`), with no free tier.

## Anti-Bias Cross-Check: Cloudflare Workers

### Devil's Advocate — Weaknesses

1. The free tier caps CPU-time at **10ms per invocation** (I/O wait excluded). Simple CRUD (adding an expense, listing history) is well within this, but generating recurring expense/income entries (FR-014/FR-016 — up to a 12-month horizon of entries created in one request) runs several sequential Supabase inserts in a single Worker invocation. This should be measured on first use rather than assumed safe.
2. Cloudflare is actively consolidating Pages into Workers — docs and community content may still default to describing the older Pages model, risking a future config change being guided by a deprecated path.
3. A documented bug: `nodejs_compat` combined with certain patterns throws `require is not defined`, and **non-prerendered routes have a known `[object Object]` rendering bug**. This directly applies here — the dashboard, month screen, and history screen are all SSR, non-prerendered, and sit behind `src/middleware.ts` auth, exactly the route shape the bug affects.
4. `wrangler rollback` only reverts Worker code — bound resources (`SUPABASE_URL`/`SUPABASE_KEY` secrets) are **not** rolled back automatically, so a rollback after a config-related incident can leave the app in an inconsistent state.
5. `wrangler.jsonc`'s `name` field is still `10x-astro-starter` (the starter template's default), not `hajsownik`. The first production deploy will register the Worker under the starter's name in the Cloudflare dashboard unless renamed first.

### Pre-Mortem — How This Could Fail

The team deployed Hajsownik to Cloudflare Workers, assuming that since the adapter worked locally, production would behave identically. A few weeks in, the month screen — SSR and non-prerendered because it requires an authenticated session — started intermittently rendering as `[object Object]` after a routine Astro/Cloudflare dependency bump, the same documented `nodejs_compat` rendering bug from research. Nobody caught it immediately because `npm run smoke` only exercises the auth flow (signup/signin/signout), not the month screen's actual data rendering, so there was no regression test covering the affected route shape. Around the same time, defining a recurring expense with a full 12-month horizon started taking noticeably longer than expected — nobody had measured the real execution time of the sequential Supabase inserts against the free tier's CPU-time limit, because testing at small scale (a handful of expenses) never exposed it. Both issues trace back to the same root cause: the team verified the adapter worked, but never verified it against the two route shapes (auth-gated SSR pages, and a multi-insert-per-request path) most likely to diverge from local behavior.

### Unknown Unknowns

- Cloudflare is actively consolidating Pages into Workers, but docs and community content still largely use "Pages" language — easy to land on an outdated guide describing the path Cloudflare is moving away from.
- `wrangler rollback` reverts only Worker code — any secret/env var change made between deployments is **not** rolled back with it, which can create false confidence during incident response.
- The 10ms CPU-time free-tier limit is per-invocation, excluding I/O wait — standard "response time" monitoring won't surface it directly; CPU-time specifically must be checked in the Cloudflare dashboard.
- Official Cloudflare MCP servers are new (2025) and actively evolving — treat them as a convenience, not a stable contract, until independently verified.
- `wrangler.jsonc`'s `name: "10x-astro-starter"` is easy to miss before the first real deploy — it's cosmetic (doesn't break functionality) but will misname the Worker in the dashboard and in any future `wrangler` commands that reference it by name.

## Operational Story

- **Preview deploys**: `wrangler versions upload` publishes a new Worker version with a preview URL without promoting it to production traffic; `wrangler versions deploy` promotes a specific version to production. No PR-fork restrictions apply since deploys are triggered from the repo's own CI, not third-party forks.
- **Secrets**: `SUPABASE_URL`/`SUPABASE_KEY` live in `.dev.vars` (gitignored) for local Cloudflare dev, and are pushed to production via `npx wrangler secret put <NAME>` — stored encrypted, readable only by the Worker at runtime, never committed to the repo. Rotation is done by re-running `wrangler secret put` with the new value.
- **Rollback**: `npx wrangler rollback [deployment-id]` reverts Worker code instantly. Caveat (see risk register): bound secrets are not rolled back with it — a config-related incident needs a separate, deliberate fix.
- **Approval**: production deploys (`wrangler deploy` / `wrangler versions deploy`) are triggered by a human merging to `master` (CI auto-deploy per `tech-stack.md`'s `ci_default_flow: auto-deploy-on-merge`). Destructive actions — rotating the primary Supabase key, deleting the Worker, changing billing — remain manual dashboard/CLI actions performed by a human, never agent-initiated.
- **Logs**: `npx wrangler tail` streams live production logs read-only from the terminal; the Cloudflare dashboard's Analytics/Logs view is the fallback for historical data.

## Risk Register

| Risk                                                                                                                 | Source                              | Likelihood | Impact | Mitigation                                                                                                                                                                         |
| ---------------------------------------------------------------------------------------------------------------------- | ------------------------------------ | ---------- | ------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Bulk recurring-entry generation (up to 12 months in one request) could approach the free-tier 10ms CPU-time limit     | Devil's advocate                    | L          | M      | Measure actual execution time of a 12-month recurring definition on first real use; batch the Supabase inserts if needed; upgrade to the $5/mo paid plan (30s CPU limit) if it recurs. |
| `nodejs_compat` rendering bug (`[object Object]`) on non-prerendered routes — hits dashboard/month/history screens directly | Devil's advocate / Research finding  | M          | M      | Extend `npm run smoke` to also assert the month screen renders real totals (not just auth status codes); re-check after every Astro/Cloudflare dependency bump.                  |
| Cloudflare's Pages→Workers consolidation could mean docs/examples target a deprecated path                           | Devil's advocate / Research finding | L          | M      | Confirm any new `wrangler.jsonc` change targets the Workers deploy path explicitly before applying; record the confirmed path in `context/deployment/deploy-plan.md`.            |
| `wrangler rollback` reverts Worker code only, not secrets/bindings                                                    | Devil's advocate / Unknown unknowns | L          | M      | Treat secret changes as a separate, deliberate step from code rollback; document each production secret change alongside the corresponding deploy.                              |
| Worker is still named `10x-astro-starter` in `wrangler.jsonc`, not `hajsownik`                                        | Devil's advocate (project-specific)  | H          | L      | Rename `name` in `wrangler.jsonc` to `hajsownik` before the first production deploy.                                                                                              |
| Official Cloudflare MCP servers are new (2025) and actively evolving                                                  | Research finding                    | L          | L      | Not required for MVP deploy — CLI (`wrangler`) is sufficient.                                                                                                                      |

## Getting Started

1. Rename `name` in `wrangler.jsonc` from `10x-astro-starter` to `hajsownik` before the first production deploy.
2. Confirm `wrangler.jsonc` targets the Workers deploy path (already does — `main`/`assets` are set correctly) and keep `compatibility_flags: ["nodejs_compat"]` explicit rather than relying on `compatibility_date`-based defaults.
3. Push production secrets: `npx wrangler secret put SUPABASE_URL` and `npx wrangler secret put SUPABASE_KEY` (mirrors the `.dev.vars` values already used for local Cloudflare dev).
4. Run `npm run build` then `npx wrangler deploy` for the first production deployment.
5. Verify end-to-end with `npx wrangler tail` running alongside a manual pass through signup → add expense → month screen → history → signout against the production URL, specifically checking that the month screen (non-prerendered) renders correctly.

## Out of Scope

The following were not evaluated in this research:

- Docker image configuration
- CI/CD pipeline setup
- Production-scale architecture (multi-region, HA, DR)
