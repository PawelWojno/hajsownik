<!-- IMPL-REVIEW-REPORT -->
# Implementation Review: Password reset Implementation Plan

- **Plan**: context/changes/password-reset/plan.md
- **Scope**: Phase 2 of 3
- **Reviewed phases**: 2
- **Date**: 2026-10-10
- **Verdict**: APPROVED
- **Findings**: 0 critical, 1 warning, 0 observations

## Verdicts

| Dimension | Verdict |
|-----------|---------|
| Plan Adherence | PASS |
| Scope Discipline | PASS |
| Safety & Quality | WARNING |
| Architecture | PASS |
| Pattern Consistency | PASS |
| Success Criteria | PASS |

## Evidence

Review done inline (no sub-agents): one commit (`1d90fdd`), 6 source files (+258/−1) plus change artifacts.

- **Plan Adherence**: all five "Changes Required" items present — `src/pages/auth/reset-callback.ts` (zod `code`, `exchangeCodeForSession`, success → `/auth/update-password`, missing/invalid/failed → `/auth/forgot-password?error=` with the reset-specific message, null client → "Supabase is not configured"), `UpdatePasswordForm.tsx` + `update-password.astro` (two fields, client validation, local `MIN_PASSWORD_LENGTH`), `src/pages/api/auth/update-password.ts` (`prerender = false`, zod, session check, `updateUser`), `/auth/update-password` in `PROTECTED_ROUTES`, smoke steps. One order difference inside the endpoint: the session check runs before zod parsing (plan listed zod first); harmless and cheaper.
- **Scope Discipline**: nothing from "What We're NOT Doing" appeared; `callback.ts` untouched. Extra files in the commit are the phase 1 review report, the accepted-behavior note in `change.md` and the roadmap note on the `#error` fragment — documentation only.
- **Safety & Quality**: `getUser()` is called inside the endpoint, because `PROTECTED_ROUTES` matches `startsWith("/auth/update-password")` and does not cover `/api/auth/update-password`. Redirect targets are fixed paths; error text goes through `encodeURIComponent` and is rendered as React text. One gap, see F1.
- **Pattern Consistency**: mirrors `callback.ts`/`signup.ts` (zod, `?error=` redirects, null-client guard) and `SignUpForm.tsx` (password + confirm validation, `PasswordToggle`).
- **Success Criteria**: lint, `astro check` (0/0/0) and build passed on the phase 2 code; `npm run smoke` "All smoke steps passed" on dev server and on the production preview (port 4322) after reordering the end-of-file steps; manual items 2.5–2.8 confirmed by the user. A second `npm run lint` on the committed state was clean. The earlier smoke 500 ("fetch failed") was traced to an unread JSON body of the anonymous `/api/expenses` 401 breaking the next request on the same connection, and fixed by step order (comment in `scripts/smoke.mjs`).
- **Lessons**: the rule in `lessons.md` ("Wire up emailRedirectTo and a callback route…") is met for local dev; the production Redirect URL is phase 3.

## Findings

### F1 — Other sessions survive a password reset

- **Severity**: ⚠️ WARNING
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Safety & Quality
- **Location**: src/pages/api/auth/update-password.ts:36-41
- **Detail**: After `updateUser({ password })` succeeds, the endpoint redirects without ending the account's other sessions. Someone who forgot their password may do so because the account was compromised; an attacker's existing session (refresh token) would stay valid after the reset. Supabase documents a `signOut({ scope: "others" })` that terminates every session except the current one (`guides/auth/signout.mdx`, via Context7). That `updateUser` does not already revoke them is NOT confirmed from the docs reviewed — the Context7 pages show the scopes but not that behavior — so this is a likely gap, not a verified one. The plan is silent on it.
- **Fix**: After a successful `updateUser`, call `await supabase.auth.signOut({ scope: "others" })` before redirecting to `/dashboard`.
- **Decision**: FIXED — `await supabase.auth.signOut({ scope: "others" })` added after a successful `updateUser` in `src/pages/api/auth/update-password.ts` (best effort, result ignored so a successful reset never turns into an error). Re-checked after the change: prettier, `npm run lint`, `astro check` (0 errors) and `npm run smoke` on the dev server all pass; the smoke steps that sign in with the new password still pass, so the current session is not ended. Not covered by an automated test: that a second, older session really gets revoked.
