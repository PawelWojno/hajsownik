---
bootstrapped_at: 2026-10-06T22:18:08Z
starter_id: 10x-astro-starter
starter_name: "10x Astro Starter (Astro + Supabase + Cloudflare)"
project_name: hajsownik
language_family: js
package_manager: npm
cwd_strategy: git-clone
bootstrapper_confidence: first-class
phase_3_status: ok
audit_command: "npm audit --json"
---

## Hand-off

```yaml
starter_id: 10x-astro-starter
package_manager: npm
project_name: hajsownik
hints:
  language_family: js
  team_size: solo
  deployment_target: cloudflare-pages
  ci_provider: github-actions
  ci_default_flow: auto-deploy-on-merge
  bootstrapper_confidence: first-class
  path_taken: standard
  quality_override: false
  self_check_answers: null
  has_auth: true
  has_payments: false
  has_realtime: false
  has_ai: false
  has_background_jobs: false
```

### Why this stack

Hajsownik is a small-scale, solo-owned household budgeting web app with a tight 5-week after-hours MVP timeline and a hard requirement for email+password auth with email verification and password reset. The recommended default for `(web, js)`, 10x Astro Starter, clears all four agent-friendly gates and bundles auth, a PostgreSQL database, and edge deployment in one pinned stack — matching the PRD's auth-heavy, no-payments/no-realtime/no-AI feature profile without assembling those pieces separately. Its bootstrapper confidence is first-class (registered CLI, not yet battle-tested end-to-end), so scaffolding should mostly be smooth with occasional manual steps. Deployment defaults to Cloudflare Pages (the starter's own default) and CI runs on GitHub Actions with auto-deploy-on-merge, both accepted as the starter's standard shape for a solo build.

## Pre-scaffold verification

| Signal      | Value                                              | Severity | Notes                                                              |
| ----------- | --------------------------------------------------- | -------- | ------------------------------------------------------------------- |
| npm package | not run                                              | —        | `cmd_template` starts with `git clone`, not an npm `create-*` CLI    |
| GitHub repo | `przeprogramowani/10x-astro-starter` last pushed 2026-09-12T21:16:08Z | fresh    | from card `docs_url`; within the last 3 months                      |

## Scaffold log

**Resolved invocation**: `git clone https://github.com/przeprogramowani/10x-astro-starter .bootstrap-scaffold && cd .bootstrap-scaffold && npm install`
**Strategy**: git-clone
**Exit code**: 0
**Files moved**: 21
**Conflicts (.scaffold siblings)**: CLAUDE.md
**.gitignore handling**: moved silently (no prior cwd `.gitignore`)
**.bootstrap-scaffold cleanup**: deleted (cloned `.git/` removed before move-up)

## Post-scaffold audit

**Tool**: `npm audit --json`
**Summary**: 0 CRITICAL, 10 HIGH, 2 MODERATE, 0 LOW
**Direct vs transitive**: 0/2/0/0 direct of total 0/10/2/0

#### CRITICAL findings

None.

#### HIGH findings

- `@astrojs/cloudflare` (direct, range `>=12.6.8`) — via `@cloudflare/vite-plugin`, `wrangler`. Fix available: `@astrojs/cloudflare@12.6.13` (major bump).
- `wrangler` (direct, range `<=0.0.0-7ae5dd357 || >=4.16.0`) — via `miniflare`. Fix available: `wrangler@4.15.2` (major bump).
- `@cloudflare/vite-plugin` (transitive, range `<=0.0.0-fff677e35 || >=1.2.3`) — via `miniflare`, `wrangler`. Fix available via `@astrojs/cloudflare@12.6.13`.
- `miniflare` (transitive, range `<=0.0.0-fec45ed61 || >=4.20250508.3`) — via `sharp`, `undici`. Fix available via `wrangler@4.15.2`.
- `sharp` (transitive, range `<0.35.5`) — librsvg vulnerability CVE-2026-96889 (GHSA-wq5f-xc86-pv6w). Fix available via `wrangler@4.15.2`.
- `undici` (transitive, range `7.0.0 - 7.29.0`) — 10 advisories (DoS via WebSocket/decompression/retry handling, cross-user cookie disclosure, TLS validation bypass; see GHSA-3wwx-pv8p-q78v and related). Fix available via `wrangler@4.15.2`.
- `brace-expansion` (transitive, range `<=1.1.20 || 4.0.0 - 5.0.11`) — quadratic-time/CPU DoS via brace expansion (GHSA-q2hr-2g5m-vwhr, GHSA-qhr7-859c-m2p7, GHSA-6j4f-fj2g-mc7p). Fix available (non-major).
- `devalue` (transitive, range `<=5.9.2`) — serialization/CPU-amplification issues (GHSA-j22f-vq7h-c4qm and related). Fix available (non-major).
- `http-cache-semantics` (transitive, range `<=4.2.0`) — max-stale handling can disclose cross-user cached responses (GHSA-ch52-4w7c-c8xp). Fix available (non-major).
- `source-map-js` (transitive, range `1.0.0 - 1.2.1`) — event-loop DoS via indexed source-map section offsets (GHSA-68fv-2mgg-jv7q). Fix available (non-major).

#### MODERATE findings

- `fast-uri` (transitive, range `3.0.0 - 3.1.7`) — inconsistent host case normalization via percent-encoded octets (GHSA-hrr3-gc8f-f4qj). Fix available (non-major).
- `smol-toml` (transitive, range `<=1.8.0`) — quadratic-time `parse()` (GHSA-r4xh-jqrq-34v2). Fix available (non-major).

#### LOW / INFO findings

None.

#### Post-fix update (2026-10-07)

Ran `npm audit fix` (no `--force`) at the user's request. Result: 1 package added, 17 changed; 7 of the 12 original findings resolved via non-breaking bumps (`brace-expansion`, `devalue`, `http-cache-semantics`, `source-map-js`, `undici`, `fast-uri`, `smol-toml`). Re-ran `npm audit --json` after: **0 CRITICAL, 5 HIGH, 0 MODERATE, 0 LOW** remain.

Remaining 5 HIGH findings are the cluster that only resolves via `npm audit fix --force` (a downgrade, not a forward fix — see rationale below): `@astrojs/cloudflare` (direct), `wrangler` (direct), `@cloudflare/vite-plugin`, `miniflare`, `sharp` (all transitive). Deliberately left as-is: npm's suggested "fix" for this cluster is a multi-version downgrade (`@astrojs/cloudflare` 14.x → 12.6.13, `wrangler` 4.131.1 → 4.15.2), not an upstream patch — the vulnerable ranges reported by `npm audit` have no upper bound, meaning even the latest published releases (`wrangler@4.148.0`, `@astrojs/cloudflare@14.3.4` as of this check) are still flagged. No forward fix exists yet upstream. All 5 live in build/deploy tooling (Cloudflare adapter, Wrangler CLI, the local Miniflare emulator), not in code shipped to end users' browsers — lower urgency for now. Revisit via `npm audit` once upstream ships a real patch, or before first production deploy.

## Hints recorded but not acted on

| Hint                     | Value           |
| ------------------------ | ---------------- |
| bootstrapper_confidence  | first-class      |
| quality_override         | false            |
| path_taken               | standard         |
| self_check_answers       | null             |
| team_size                | solo             |
| deployment_target        | cloudflare-pages |
| ci_provider              | github-actions   |
| ci_default_flow          | auto-deploy-on-merge |
| has_auth                 | true             |
| has_payments             | false            |
| has_realtime             | false            |
| has_ai                   | false            |
| has_background_jobs      | false            |

## Next steps

Next: a future skill will set up agent context (CLAUDE.md, AGENTS.md). For now, your project is scaffolded and verified — happy hacking.

Useful manual steps in the meantime:
- `git init` (if you have not already) to start your own repo history.
- Review the `.scaffold` sibling this run created (`CLAUDE.md.scaffold`) and decide which version of each file to keep — your existing `CLAUDE.md` (10xDevs toolkit instructions) won over the starter's own `CLAUDE.md`.
- Address audit findings per your project's risk tolerance — the two direct HIGH findings (`@astrojs/cloudflare`, `wrangler`) have fixes available via a major-version bump; the rest are transitive and resolve once the direct packages are updated.
