---
date: 2026-10-10T00:00:00+02:00
researcher: Claude (Sonnet 5.5)
git_commit: 02d9d2d33fa341e902591f8bf082016890be45c5
branch: master
repository: Hajsownik
topic: "password-reset — what the codebase already provides for a Supabase password-reset-by-email flow (FR-003)"
tags: [research, codebase, auth, supabase, callback, middleware, password-reset]
status: complete
last_updated: 2026-10-10
last_updated_by: Claude (Sonnet 5.5)
last_updated_note: "Added external research (Context7) answering Open Questions 1 and 2; Q2 answer contradicts the earlier unverified assumption"
---

# Research: password-reset — existing auth patterns to build FR-003 on

**Date**: 2026-10-10 (time-of-day not recorded)
**Researcher**: Claude (Sonnet 5.5)
**Git Commit**: 02d9d2d33fa341e902591f8bf082016890be45c5
**Branch**: master
**Repository**: Hajsownik

## Research Question

`change.md` for `password-reset` has no intent text, so the question is taken from the roadmap (S-03) and PRD (FR-003): what does the codebase already do that a "reset password by email" flow must follow or integrate with, and what is missing?

## Summary

- On the inspected paths (`src/`, `scripts/smoke.mjs`, `supabase/config.toml`, `context/foundation/`) no password-reset or recovery code exists. A case-insensitive search of `context/foundation/` for `password|reset|recover` finds only PRD/shape-notes/roadmap/lessons text, and `Glob` of `src/**/*{auth,signin,signup,confirm,callback,middleware,supabase}*` lists no reset-related file. `src/` itself was not grepped for `resetPasswordForEmail`/`updateUser`; the negative claim rests on the file listings of `src/pages/auth`, `src/pages/api/auth` (signin, signup, signout) and `src/components/auth`.
- The pattern to copy is the signup confirmation flow: a form posts to `/api/auth/*`, the API route calls Supabase with `emailRedirectTo: ${context.url.origin}/auth/callback`, and `src/pages/auth/callback.ts` calls `exchangeCodeForSession(code)`.
- **The callback is not reusable as-is for recovery**: after a successful exchange it always redirects to `/dashboard` (`callback.ts:31`), and its error text is confirmation-specific (`callback.ts:10-11`). A recovery link needs to land on a "set new password" page instead.
- The middleware (`src/middleware.ts`) redirects any signed-in user away from `/`, `/auth/signin`, `/auth/signup` (exact paths) to `/dashboard`; any new "forgot password" page is outside that list unless added, and the "set new password" page needs the opposite treatment (must be reachable while signed in, because the code exchange creates a session).
- A repo lesson already prescribes the rules for this change (`lessons.md:12-17`): pass `emailRedirectTo` from the request origin, point it at a route that calls `exchangeCodeForSession`, have the origin in the dashboard Redirect URLs allowlist, and verify by clicking the real email link.

## Detailed Findings

### Existing auth endpoints and pages

- API routes: `signin.ts`, `signup.ts`, `signout.ts` under `src/pages/api/auth/` (directory listing). Pages: `signin.astro`, `signup.astro`, `confirm-email.astro`, plus `callback.ts` in `src/pages/auth/`.
- `signup.ts:7-11` validates with zod (`z.email`, password `min(6)`), errors redirect to `/auth/signup?error=<message>` (`signup.ts:18`). `signup.ts:26-33` passes `emailRedirectTo: ${context.url.origin}/auth/callback`. `signup.ts` has no `export const prerender = false`; `callback.ts:5` does. (CLAUDE.md says API routes must export it; whether the others work without it was not tested.)
- `signin.ts:6-7` reads email/password with a bare `as string` cast, no zod; errors are redirected as `?error=` with Supabase's raw `error.message` (`signin.ts:16`). A reset endpoint should follow `signup.ts` (zod), not `signin.ts`.
- Pages use the same card layout (`signin.astro:9-22`) and render a React form island with `serverError={error}` read from `?error=`. `confirm-email.astro` is the pattern for a static "check your email" page (it branches on `import.meta.env.DEV` for the auto-confirmed message, lines 3-5).
- Forms are plain HTML `POST` with `noValidate` and client-side validation that only calls `preventDefault` on failure (`SignInForm.tsx:33-37, 40`). Reusable pieces: `FormField`, `PasswordToggle`, `SubmitButton`, `ServerError` in `src/components/auth/`. `SignUpForm.tsx` has password + confirm-password validation and a `MIN_PASSWORD_LENGTH` constant (lines 17-46, 70-71) to reuse for the new-password form.
- UI copy in the auth pages is English; `src/lib/http.ts:7-9` messages are Polish (those serve the expense/income JSON API).

### Callback route (`src/pages/auth/callback.ts`)

- Validates `?code` with zod (`:7`, `:14-17`), exchanges it (`:24`), on error redirects to `/auth/signin?error=<friendly confirmation message>` (`:25-29`), on success redirects to `/dashboard` (`:31`). Git history of this file: `3f833aa` (created callback), `ca959cf` (friendly error).
- Consequence for recovery (inference, not run): if the reset email pointed at `/auth/callback`, a successful exchange would send the user to the dashboard already signed in, never showing a new-password form. Options for the plan: a `next` query parameter on the callback (needs allow-listing to avoid open redirect), or a separate route (e.g. `/auth/reset-callback`) / pointing `emailRedirectTo` directly at a page that does the exchange.
- A PKCE caveat is documented in the code itself: opening a link on another device fails with a missing code verifier (`callback.ts:26-27`). The same applies to reset links, and the fallback message must say something actionable for reset ("request a new link"), not "your email is confirmed".

### Middleware (`src/middleware.ts`)

- `PROTECTED_ROUTES = ["/dashboard", "/settings"]` matched with `startsWith` (`:4, :20`); `SIGNED_OUT_ONLY_ROUTES = ["/", "/auth/signin", "/auth/signup"]` matched exactly (`:6, :26`).
- `/auth/confirm-email` and `/auth/callback` are in neither list, so they are reachable in both states. A `/auth/forgot-password` page would be too, unless the plan adds it to `SIGNED_OUT_ONLY_ROUTES`. A "set new password" page would be reachable signed-in or not; the plan must decide how to reject direct visits without a recovery session (middleware only knows `locals.user`, not whether the session came from a recovery link).
- `createClient` (`src/lib/supabase.ts:5-22`) returns `null` when env is missing; every API route handles that with a redirect (`signup.ts:23-25`).

### Supabase configuration visible in the repo

- `supabase/config.toml:154` `site_url = "http://127.0.0.1:3000"`, `:156` `additional_redirect_urls = ["https://127.0.0.1:3000"]` — neither includes the Astro dev port (4321, per CLAUDE.md smoke default). Local `emailRedirectTo` URLs on `http://localhost:4321/...` may therefore be rejected/fall back to Site URL by the local stack; not tested here.
- `[auth.email]`: `enable_confirmations = false` (`:209`), `secure_password_change = false` (`:211`), `max_frequency = "1s"` (`:213`, covers signup confirmation and password reset emails per the comment at `:212`), `minimum_password_length = 6` (`:175`) — matches the zod `min(6)` in `signup.ts:9`.
- Local emails are caught by Inbucket (`[inbucket]` at `:99`), which is what a manual/smoke run can read. The production dashboard settings (confirmations on/off, Redirect URLs allowlist) are not in the repo and were not inspected.

### FR-001 gate: "email must be confirmed before reset is usable"

- Source: `prd.md:56, 60-61`. Nothing in the repo implements this gate; with local `enable_confirmations = false` every local user is already confirmed, so locally the gate cannot be exercised. Whether production has confirmations enabled is unknown from the repo (the confirm-email page text and lesson at `lessons.md:15` suggest confirmation emails are sent in production, which implies it is on).
- **Corrected by Context7 (see "External research" below)**: my earlier recollection was wrong — GoTrue does NOT enforce the FR-001 gate; the app must.

### Smoke test (`scripts/smoke.mjs`)

- Existing auth checks: anonymous `/dashboard` → 302 `/auth/signin` (`:62`), signup (`:65`), signin wrong/correct password (`:70-76`), signout (`:168`), post-signout redirect (`:169`). The helper `request(path, { method, form | json })` is used throughout. No reset or callback cases exist in the lines grepped.
- A reset smoke case can cover the HTTP surface (POST forgot-password → redirect; unauthenticated visit to the new-password page), but the full link round trip needs Inbucket and was not checked for availability in CI (CI runs a local Supabase CLI instance per CLAUDE.md).

## Code References

- `src/pages/auth/callback.ts:24-31` — code exchange; hard-coded redirect to `/dashboard`
- `src/pages/auth/callback.ts:10-11, 25-29` — confirmation-specific error copy
- `src/pages/api/auth/signup.ts:7-11, 26-33` — zod schema and `emailRedirectTo` pattern to copy
- `src/pages/api/auth/signin.ts:6-16` — unvalidated form read; raw Supabase error shown
- `src/middleware.ts:4-6, 20-28` — protected vs signed-out-only route lists
- `src/lib/supabase.ts:5-22` — SSR client factory (cookie-based)
- `src/components/auth/SignInForm.tsx` / `SignUpForm.tsx` — form island patterns; password + confirm validation in SignUpForm
- `src/pages/auth/signin.astro:14-20` — place to add a "Forgot password?" link
- `supabase/config.toml:154-156, 175, 209-213` — site URL, redirect allowlist, password/email settings
- `scripts/smoke.mjs:62-76, 168-169` — existing auth smoke cases
- `context/foundation/roadmap.md:119-130` — S-03 definition (outcome, risk "Low", GitHub #3)
- `context/foundation/lessons.md:12-17` — emailRedirectTo + callback rule

## Architecture Insights

- Auth flows are server-mediated: HTML form → `/api/auth/*` POST → redirect with `?error=`, no client fetch. A reset flow fits this with two POSTs (request link; set new password).
- Session lives in cookies via `@supabase/ssr`; the code exchange both creates the session and sets cookies, so the "set new password" step is an authenticated `supabase.auth.updateUser({ password })` call on that session (Supabase API usage as I know it; confirm in docs).
- Security-relevant choices the plan must make explicitly: do not reveal whether an email is registered (same "if the address exists, we've sent a link" response either way — `signin.ts` currently exposes raw errors but that is login, not enumeration); allow-list any `next` target; sign the user out or keep them signed in after the change (decision); consider `secure_password_change`.
- All new Auth-email code must satisfy the lesson in `lessons.md:12-17`.

## Historical Context (from prior changes)

- `lessons.md:12-17` — written after signup confirmation links led nowhere; `resetPasswordForEmail` is named in its scope, so this change is a direct target of the rule. Supported by git history: `3f833aa` and `ca959cf` touched `callback.ts`.
- `context/foundation/prd.md:56-61` / `shape-notes.md:87-92` — FR-003 must-have; its counter-argument resolution requires confirmed email before reset (see FR-001 gate above). Parts supported by repo: requirement stated; implementation: absent.
- `context/foundation/roadmap.md:119-130` — S-03 has no prerequisites and is independent of the household/data work; risk assessed "Low".
- `context/archive/2026-10-09-category-management/research.md` exists as the prior research example; not related to auth, not read.

## Related Research

None related under `context/changes/**/research.md` (only `bootstrap-verification` is active, no research file observed) or the archived changes' listed files.

## External research (Context7, 2026-10-10)

Sources: `/supabase/supabase` (docs: `guides/auth/passwords.mdx`, `sessions/pkce-flow.mdx`) and `/supabase/auth` (GoTrue Go source, v2.197.0 listed).

**Q1 — which route does the link target?** Two documented options:
- **Code flow (what the repo does today)**: `resetPasswordForEmail(email, { redirectTo })`, redirect URL must be in the project's redirect allowlist; the callback calls `exchangeCodeForSession(code)`. The documented Next.js callback reads a `next` param and falls back to `/` unless it starts with `/` (open-redirect guard). Still has the cross-device PKCE limitation already noted in `callback.ts:26-27`.
- **Token-hash flow (documented for password reset in passwords.mdx, "PKCE flow" section)**: edit the *reset password email template* so the link is `{{ .SiteURL }}/auth/confirm?token_hash={{ .TokenHash }}&type=recovery&next=/account/update-password`; a server route calls `verifyOtp({ token_hash, type })` and redirects to `next`; the update page then calls `updateUser({ password })` on that session. Because it needs no code verifier stored in the requesting browser, it is not expected to fail when the link is opened on another device (inference from the mechanism; not verified). Costs: the email template must be changed in the Supabase dashboard (production) and in `supabase/config.toml` / a template file for local; the link is built from `{{ .SiteURL }}`, so Site URL must be correct per environment (lesson at `lessons.md:12-17` applies).

**Q2 — does Supabase enforce "confirmed email before reset" (FR-001)?** No, on the inspected GoTrue source:
- `internal/api/recover.go` (Recover handler): finds user by email and sends the recovery email without checking `IsConfirmed()`; an unknown email returns 200 with an empty body (no enumeration at the API level).
- `internal/api/verify.go` (`recoverVerify`): when the recovery link is verified and the user is unconfirmed, the user is auto-confirmed (`user.Confirm`). So a reset link effectively confirms the address.
- Consequence: the PRD gate ("verified email before reset is usable", `prd.md:56,60-61`) is not provided by Supabase. For an unconfirmed account the reset email still goes out and using it confirms the email. Whether that is acceptable (the link proves control of the mailbox, which is what the gate was meant to guarantee) or whether the app must block requests for unconfirmed accounts is a **product decision for the plan**; blocking would need an admin/service-role lookup of `email_confirmed_at`, which the repo does not currently use.
- Related: `signup.go` does not overwrite the password when signing up an already-existing unconfirmed email ("we can't be sure of their claimed identity").
- README of GoTrue: recovery links can be sent once per 60 seconds by default (local `config.toml:213` sets `1s`).

## Open Questions

1. ~~Which route~~ Answered above in two options (code flow with allow-listed `next`, or token-hash flow with email template change). **Choice between them is open** — plan decision. Still open: how the update-password page rejects visits without a recovery session.
2. GoTrue does not enforce the FR-001 gate (answered above). Still open: whether production has confirmations enabled (dashboard) and whether the plan accepts "reset link confirms the email" or blocks unconfirmed accounts.
3. Is the production/local Redirect URLs allowlist updated for the new route (and local port 4321)? Dashboard step; lesson requires it.
4. After a successful password change: stay signed in and go to `/dashboard`, or sign out and go to `/auth/signin` with a success message?
5. Where is the "Forgot password?" entry point: only `signin.astro`, or also a link from the signin error state?
6. Smoke coverage: can CI read Inbucket to test the full link round trip, or only the HTTP surface?
7. `signup.ts` and `signin.ts` lack `export const prerender = false` while `callback.ts` has it — confirm whether new routes need it (CLAUDE.md says yes).
