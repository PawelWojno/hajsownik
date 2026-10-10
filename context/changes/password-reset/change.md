---
change_id: password-reset
title: Password reset
status: impl_reviewed
created: 2026-10-10
updated: 2026-10-10
archived_at: null
---

## Notes

- Accepted behavior (phase 2 manual test, 2026-10-10): clicking an already used reset link while still signed in (the session from the first click) lands on `/dashboard` with `#error=access_denied&error_code=otp_expired` in the URL and no message. Chain: Supabase → `/auth/reset-callback` without code → `/auth/forgot-password?error=…` → middleware sends the signed-in user to `/dashboard`. Signed-out users see the "invalid reset link" message as planned. Left as is by decision.
