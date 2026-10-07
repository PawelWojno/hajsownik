# Hajsownik — Production Deploy Plan (Cloudflare Workers, CI Auto-Deploy on Merge)

Approved via Plan Mode on 2026-10-07. Source research: `context/foundation/infrastructure.md` (recommended platform: Cloudflare Workers).

## What changed in this pass

- Created GitHub repo `https://github.com/PawelWojno/hajsownik` (public) — the project had no commits/remote before this.
- `wrangler.jsonc`: renamed Worker from `10x-astro-starter` to `hajsownik`.
- `.github/workflows/ci.yml`: added a `deploy` job (`needs: [ci, smoke]`, `if: github.event_name == 'push' && github.ref == 'refs/heads/master'`) using `cloudflare/wrangler-action@v3`.
- Left the old `10x-astro-starter` Worker (leftover test deployment, 3 deployments from 2026-09-03) untouched on Cloudflare.

## Manual gates — not executed by the agent, secrets never pass through chat

**A — Cloudflare API token**: `dash.cloudflare.com/profile/api-tokens` → Create Token → "Edit Cloudflare Workers" template → scope to account `d509512d3acdca34d35f6677a83a9f0b` only.

**B — Fresh production Supabase project**: new project (e.g. `hajsownik-prod`) → Settings → API → copy Project URL + `anon` key. Keep "Confirm email" **ON** (opposite of the README's local-dev step) — required by PRD FR-001 (email verification gates password reset).

**C — Push Worker secrets** (local machine, after the rename in step above):
```bash
npx wrangler secret put SUPABASE_URL
npx wrangler secret put SUPABASE_KEY
```

**D — One-time manual bootstrap deploy** (creates the `hajsownik` Worker before CI ever runs):
```bash
npm run build && npx wrangler deploy
```

**E — GitHub secret** (run by the user, hidden prompt):
```bash
gh secret set CLOUDFLARE_API_TOKEN --repo PawelWojno/hajsownik
```
`CLOUDFLARE_ACCOUNT_ID` is not sensitive — set as a repo variable (done by the agent once the repo existed):
```bash
gh variable set CLOUDFLARE_ACCOUNT_ID --repo PawelWojno/hajsownik --body "d509512d3acdca34d35f6677a83a9f0b"
```

## Grading/certification access (added after initial plan)

For the course certification review, graders need to sign in without going through email confirmation themselves. **Decision: `Confirm email` stays ON for production** (per Gate B / PRD FR-001 — do not disable it globally, that would let anyone reset a password on an email they don't control). Instead:

**Gate F — Demo account for graders** (Supabase dashboard, manual, by the user):
1. Production project → Authentication → Users → Add user.
2. Set an email + password, enable **"Auto Confirm User"** if offered (or confirm the email manually afterward from the Users list).
3. Share these credentials with graders alongside the production URL — they sign in directly, skipping `/auth/signup` and the confirmation step entirely.

This was considered against disabling `Confirm email` globally and rejected: a global toggle would weaken the account-takeover protection FR-001 was written for, for every real user, not just graders.

## First-deploy verification

App today: `/`, `/auth/signin`, `/auth/signup`, `/auth/confirm-email`, `/dashboard` — all SSR/non-prerendered (`output: "server"`, no `prerender = true` anywhere), so the `nodejs_compat` `[object Object]` risk from `infrastructure.md` applies to every route today.

After Gate D: `npx wrangler tail` in one terminal; visit the production URL; confirm `/` renders real markup; sign up with a real email and confirm via Gate B's actual confirmation email; sign in, confirm `/dashboard` shows `Welcome, <email>` as real text; sign out, confirm redirect to `/auth/signin`.

After Gates A/B/C/D/E are all done: push a trivial commit to `master`, confirm the `deploy` job runs and succeeds in the Actions tab, and `npx wrangler deployments list` shows a new deployment under the `hajsownik` Worker.

## Deferred, not done in this pass

- `scripts/smoke.mjs`'s `request()` helper discards the response body, so it can't detect an `[object Object]` render even on the one route it already fetches (`/dashboard`). Making it also capture `await response.text()` and asserting the dashboard step's body excludes the literal string `[object Object]` would close this gap — proportionate follow-up, not required to ship.

## Out of scope

Docker, multi-region/HA, GitHub Actions environments/protection rules, any change to the old `10x-astro-starter` Worker.
