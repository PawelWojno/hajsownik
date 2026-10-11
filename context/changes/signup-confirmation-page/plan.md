# Signup confirmation page — Implementation Plan

## Overview

When the user clicks the signup confirmation link, Supabase confirms the e-mail and redirects to `/auth/callback?code=…`. If `exchangeCodeForSession` fails (typically the link is opened in another browser/device, so the PKCE verifier cookie is missing; or the code was already used), the user currently lands on `/auth/signin?error=…` with a **red error banner**, although their e-mail is confirmed. Show a dedicated **success page** instead.

## Current State Analysis

- `src/pages/auth/callback.ts:24-29` — exchange error → `redirect(/auth/signin?error=CONFIRMATION_FAILED_MESSAGE)`; the message even says "Your email is confirmed…", rendered red by `ServerError` in `SignInForm`.
- `src/pages/auth/callback.ts:15-17` — missing/invalid `code` param → red error (a different case: confirmation may not have happened). Stays unchanged.
- `src/pages/auth/confirm-email.astro` — existing success-page layout (emoji, gradient heading, link) to mirror.
- `src/middleware.ts:4-6` — `/auth/confirmed` is neither protected nor signed-out-only: no change needed (a failed exchange means user is signed out; a signed-in visitor seeing it is harmless).
- `scripts/smoke.mjs` — has cases for `reset-callback` (lines ~90-96) but none for `/auth/callback`.
- Lesson (`context/foundation/lessons.md`): verify auth email flows by clicking the real link, not only the API response.

## Desired End State

Opening the confirmation link in a browser without the PKCE verifier shows a neutral "Sign in to continue" page (➡️, no success claim) with a "Go to sign in" link — no red banner. Missing/invalid code still shows the red error on sign-in.

### Key Discoveries

- Assumption (unverified, only stated in the `callback.ts:9` comment): a `code` in the URL means Supabase already verified the e-mail.
- With no PKCE verifier (link opened in another browser) the library throws `AuthPKCECodeVerifierMissingError` locally, before any request to Supabase (`node_modules/@supabase/auth-js/dist/main/GoTrueClient.js:1628-1629`), so the code is never validated. Any `?code=…` therefore ends on the success page; the copy must not assert confirmation or success. Worst case is harmless: signing in with an unconfirmed account returns a clear "Email not confirmed" error.
- Chosen over narrowing the redirect to the verifier-missing error only: narrowing would still not tell a good code from a bad one, and would keep the red banner for a used/expired code opened in the original browser.

## What We're NOT Doing

- No change to the missing/invalid-code branch (stays red error on `/auth/signin`).
- No change to `reset-callback.ts` or the password-reset flow.
- No attempt to auto-sign-in another way (e.g. OTP/token-hash flow) or change Supabase email templates.
- No new SignInForm success-banner variant.

## Implementation Approach

New static page `src/pages/auth/confirmed.astro` copying the `confirm-email.astro` layout; `callback.ts` redirects there on exchange error and drops the now-unused `CONFIRMATION_FAILED_MESSAGE`. Add a smoke case. One phase.

## Phase 1: Success page on failed auto-login

### Changes Required

#### 1. Success page

**File**: `src/pages/auth/confirmed.astro` (new)

**Intent**: Tell the user their e-mail is confirmed and send them to sign in. Same look as `confirm-email.astro`.

**Contract**: Route `GET /auth/confirmed`, no params, no auth requirement. Content (agreed copy, no success claim): ➡️, heading "Sign in to continue", description "We couldn't sign you in automatically. If you've just confirmed your email, continue with your password.", link `/auth/signin` "Go to sign in".

#### 2. Callback redirect

**File**: `src/pages/auth/callback.ts`

**Intent**: On `exchangeCodeForSession` error redirect to the success page instead of sign-in with an error; remove the unused message constant and its comment.

**Contract**: Exchange error → `context.redirect("/auth/confirmed")`. Other branches (invalid params, no supabase, success → `/dashboard`) unchanged.

#### 3. Smoke test

**File**: `scripts/smoke.mjs`

**Intent**: Lock in the redirect, in the style of the `reset-callback` cases.

**Contract**: Case "callback with an invalid code sends the user to the confirmed page": `request("/auth/callback?code=invalid")` → `{ status: 302, location: "/auth/confirmed" }`. Case: `/auth/callback` without code → `{ status: 302, locationPrefix: "/auth/signin?error=" }`. Case: `GET /auth/confirmed` → `{ status: 200 }`. Place the three steps next to the `reset-callback` steps, before "signup creates account" (the cookie jar must still be anonymous, i.e. without a PKCE verifier).

### Success Criteria

#### Automated Verification

- Lint passes: `npm run lint`
- Type check passes: `npx astro check`
- Build passes: `npm run build`
- Smoke passes against a running preview: `npm run smoke`

#### Manual Verification

- Request a real signup confirmation e-mail (production/preview with confirmations on), open the link in a different browser than the one used for signup → "Sign in to continue" page, no red banner.
- Open the same link in the original browser → lands on `/dashboard` (happy path unchanged).
- `/auth/callback` (no code) still shows the red error on sign-in.

## Testing Strategy

Smoke covers the redirect: the anonymous request has no PKCE verifier cookie, so `?code=invalid` hits the same `AuthPKCECodeVerifierMissingError` branch as a real link opened in another browser. The real e-mail link (both browsers) is still verified manually, per the lessons rule.

## References

- `src/pages/auth/callback.ts`, `src/pages/auth/confirm-email.astro`, `scripts/smoke.mjs`
- Lesson: "Wire up emailRedirectTo and a callback route for every Supabase Auth email"

## Progress

### Phase 1: Success page on failed auto-login

#### Automated

- [x] 1.1 Lint passes: `npm run lint` — 7f09bd6
- [x] 1.2 Type check passes: `npx astro check` — 7f09bd6
- [x] 1.3 Build passes: `npm run build` — 7f09bd6
- [x] 1.4 Smoke passes against a running preview: `npm run smoke` — 7f09bd6

#### Manual

- [x] 1.5 Real confirmation link opened in a different browser shows the "Sign in to continue" page, no red banner — 7f09bd6
- [x] 1.6 Same link in the original browser still lands on `/dashboard` — 7f09bd6
- [x] 1.7 `/auth/callback` without a code still shows the red error on sign-in — 7f09bd6

