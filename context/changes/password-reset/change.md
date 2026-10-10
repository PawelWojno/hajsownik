---
change_id: password-reset
title: Password reset
status: implemented
created: 2026-10-10
updated: 2026-10-11
archived_at: null
---

## Notes

- FR-001 deviation (decided in planning): the "email must be confirmed before reset is usable" gate is not enforced by blocking unconfirmed accounts. Supabase sends the recovery email regardless of confirmation and auto-confirms the account when the recovery link is verified, so clicking the link is the proof of mailbox control. Production has "Confirm email" enabled (checked by the user, 2026-10-11), so unconfirmed accounts can exist there and a reset link will confirm them.
- Accepted behavior (phase 2 manual test, 2026-10-10): clicking an already used reset link while still signed in (the session from the first click) lands on `/dashboard` with `#error=access_denied&error_code=otp_expired` in the URL and no message. Chain: Supabase → `/auth/reset-callback` without code → `/auth/forgot-password?error=…` → middleware sends the signed-in user to `/dashboard`. Signed-out users see the "invalid reset link" message as planned. Left as is by decision.
