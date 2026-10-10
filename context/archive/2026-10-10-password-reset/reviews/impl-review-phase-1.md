<!-- IMPL-REVIEW-REPORT -->
# Implementation Review: Password reset Implementation Plan

- **Plan**: context/changes/password-reset/plan.md
- **Scope**: Phase 1 of 3
- **Reviewed phases**: 1
- **Date**: 2026-10-10
- **Verdict**: APPROVED
- **Findings**: 0 critical, 0 warnings, 1 observation

## Verdicts

| Dimension | Verdict |
|-----------|---------|
| Plan Adherence | PASS |
| Scope Discipline | WARNING |
| Safety & Quality | PASS |
| Architecture | PASS |
| Pattern Consistency | PASS |
| Success Criteria | PASS |

## Evidence

First pass was inline (no sub-agents): one commit (`cb2e004`), 7 source files. Second pass (2026-10-10) re-read the same commit with two parallel reviews — plan drift, then safety and patterns — and added the observation below. Source files are unchanged since `cb2e004`, so the automated results from the first pass still stand.

- **Plan Adherence**: all five "Changes Required" items present — `supabase/config.toml` (4 exact redirect URLs added, `site_url` untouched), `src/pages/api/auth/forgot-password.ts` (zod `z.email`, `redirectTo = origin/auth/reset-callback`, unknown email → `?sent=1`, Supabase error → generic message, missing client → "Supabase is not configured"), `ForgotPasswordForm.tsx` + `forgot-password.astro`, link in `signin.astro`, `/auth/forgot-password` in `SIGNED_OUT_ONLY_ROUTES`, 4 smoke steps.
- **Scope Discipline**: nothing from "What We're NOT Doing" appeared (no `callback.ts` change, no token-hash template, no service-role). Extra files in the commit are the planned change artifacts and the roadmap status/Parked edits. The page adds two unplanned sentences; see F1.
- **Safety & Quality**: the endpoint answers identically for existing and unknown addresses (no account enumeration); the only difference is Supabase failure, a documented accepted risk. `prerender = false` present. `ServerError` renders the `error` query as React text. `redirectTo` is the request origin plus a fixed path, and those exact dev URLs are on the allowlist. Line endings: working copy has CRLF, committed `config.toml` has 0 CR (LF), so no mixed endings.
- **Pattern Consistency**: mirrors `signup.ts` (zod, `?error=` redirects, null-client guard) and `SignInForm.tsx` (email validation only, no password block). The sent card follows `confirm-email.astro`.
- **Success Criteria**: `npm run lint` pass, `npx astro check` 0 errors/0 warnings/0 hints, `npm run build` pass, `npm run smoke` "All smoke steps passed" (reported by the user on `cb2e004`), manual items 1.5–1.7 confirmed by the user and marked `[x]` with SHA `cb2e004`. Not re-run on the second pass.

## Findings

### F1 — Unplanned sentences on the forgot-password card

- **Severity**: 📝 OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Scope Discipline
- **Location**: src/pages/auth/forgot-password.astro:17-18, src/pages/auth/forgot-password.astro:29-30
- **Detail**: The phase 1 page contract asks for a sign-in-style card, a "Check your email" card on `?sent=1` (pattern `confirm-email.astro`), and a "Back to sign in" link. Two sentences are not in that contract or in the pages it copies. The sent card adds "Open it in this browser." (`forgot-password.astro:18`) — a PKCE hint already described in Key Discoveries, not in the page contract. The form card adds a subtitle `signin.astro` does not have: "Enter your email and we'll send you a link to set a new password." (`forgot-password.astro:30`). Neither changes behavior. "If an account exists…" on the same line is the planned same answer, not an extra.
- **Fix**: Leave both sentences and add them to the phase 1 page contract, so the next review treats them as specified copy.
- **Decision**: DISMISSED — copy text is an implementation detail, not scope creep: the plan's page contract specifies structure, not wording, and "Open it in this browser." follows from the accepted PKCE trade-off (plan Key Discoveries and Desired End State pt. 4). No plan or code change.
