<!-- PLAN-REVIEW-REPORT -->
# Plan Review: Password reset Implementation Plan

- **Plan**: context/changes/password-reset/plan.md
- **Mode**: Deep
- **Date**: 2026-10-10
- **Verdict**: REVISE
- **Findings**: 0 critical, 2 warnings, 1 observation

## Verdicts

| Dimension | Verdict |
|-----------|---------|
| End-State Alignment | PASS |
| Lean Execution | PASS |
| Architectural Fitness | PASS |
| Blind Spots | WARNING |
| Plan Completeness | WARNING |

## Grounding

Grounding: 8/8 existing paths ✓, 4/4 symbols ✓, brief↔plan ✓

Sprawdzone ścieżki: `supabase/config.toml`, `src/middleware.ts`, `src/pages/auth/callback.ts`, `src/pages/api/auth/signup.ts`, `src/pages/auth/signin.astro`, `src/components/auth/SignInForm.tsx`, `src/components/auth/SignUpForm.tsx`, `scripts/smoke.mjs`. Nowe pliki z planu jeszcze nie istnieją — tak ma być. Symbole: `z.email`, `exchangeCodeForSession`, `PROTECTED_ROUTES` / `SIGNED_OUT_ONLY_ROUTES`, `site_url` / `additional_redirect_urls`. `resetPasswordForEmail` przyjmuje `redirectTo` (nie `emailRedirectTo`).

## Findings

### F1 — Link w mailu nie zaczyna się od `?code=`

- **Severity**: ⚠️ WARNING
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Blind Spots
- **Location**: Phase 1 — Manual Verification; Desired End State pkt 3; Progress 1.5
- **Detail**: Kryterium ręczne mówi, że link w Inbucket zaczyna się od `http://localhost:4321/auth/reset-callback?code=`. W zainstalowanym `@supabase/auth-js` `resetPasswordForEmail` wysyła `redirectTo` jako query `redirect_to` na `POST /recover` (`node_modules/@supabase/auth-js/src/lib/fetch.ts:195-196`, wywołanie w `GoTrueClient.ts:4489-4497`). Komentarz metody mówi, że dopiero kliknięcie przekierowuje użytkownika na `redirectTo` (`GoTrueClient.ts:4414-4416`). `?code=` pojawia się na adresie aplikacji po tym przekierowaniu, nie w hrefie maila. W repo nie ma własnego szablonu recovery (`supabase/config.toml:229-232` jest zakomentowane), a `site_url` nadal buduje URL-e w mailach i wskazuje port 3000 (`config.toml:152-156`). Dokładne wpisy allowlisty bez query są poprawne: doklejanie `sb_flow_id` jest wyłączone, dopóki nie włączysz `experimental.appendPkceFlowIdToRedirects` (`GoTrueClient.ts:5736-5750`), a ten projekt tego nie włącza. Bramka fazy 1 nie przejdzie przy działającej implementacji.
- **Fix**: W kryterium 1.5, w Desired End State pkt 3 i w tytule Progress 1.5 zapisz, że href maila zawiera `redirect_to` równy `{origin}/auth/reset-callback` (bez `?code=`). `?code=` sprawdzasz dopiero po kliknięciu, w fazie 2.
- **Decision**: FIXED — zweryfikowano w `auth-js` (`fetch.ts:195-196`, `GoTrueClient.ts:4414-4416, 4489-4497`); poprawiono Desired End State pkt 3, Overview fazy 1, kryterium ręczne fazy 1, Progress 1.5 i 2.5 oraz punkt ręczny fazy 2. Uwaga: to `redirect_to`, nie `site_url`, buduje cel po kliknięciu; `site_url` jest tylko awaryjny.

### F2 — Anonimowe kroki smoke bez miejsca wstawienia

- **Severity**: ⚠️ WARNING
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Plan Completeness
- **Location**: Phase 2 — smoke, nowe hasło i strażnicy
- **Detail**: `scripts/smoke.mjs` ma jeden słoik ciasteczek (`:8`). Po kroku „signup creates account” (`:64-67`) sesja zostaje do „signout clears session” (`:168`). Anonimowe okna są tylko dwa: przed signupem (`:61-62`) i po signoucie (`:169-179`). Faza 1 mówi wprost „przed rejestracją”. Faza 2 mówi tylko „anonimowo” dla `GET /auth/update-password`, `GET /auth/reset-callback` i `POST /api/auth/update-password`, a zalogowane kroki kotwiczy po „signin accepts correct password”. Wstawienie strażników obok kroku zalogowanego da 200 zamiast 302 na `/auth/signin`, bo `PROTECTED_ROUTES` puszcza użytkownika z sesją (`src/middleware.ts:20-23`).
- **Fix**: W kontrakcie fazy 2 dopisz, że kroki anonimowe wchodzą przed „signup creates account”. Zmiana hasła zostaje po „signin accepts correct password”, a signin starym i nowym hasłem po ostatnim kroku anonimowym.
- **Decision**: FIXED — zweryfikowano w `smoke.mjs` (`:8`, `:61-67`, `:168-179`); kontrakt smoke w fazie 2 wskazuje teraz miejsce wstawienia kroków anonimowych (przed „signup creates account”). Ocena: waga bliższa OBSERVATION.

### F3 — Cytat SignInForm obejmuje walidację hasła

- **Severity**: 📝 OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Plan Completeness
- **Location**: Phase 1 — strona i formularz
- **Detail**: Kontrakt `ForgotPasswordForm` każe skopiować walidację klienta z `SignInForm.tsx:14-37`. Ten zakres obejmuje `if (!password) next.password = "Password is required"` (`SignInForm.tsx:25-27`). Formularz resetu ma tylko email. Dosłowne skopiowanie zablokuje wysyłkę, bo pola hasła nie będzie.
- **Fix**: Zawęź cytat do walidacji emaila (`SignInForm.tsx:20-24`) i napisz, że pola hasła nie ma.
- **Decision**: FIXED — cytat w kontrakcie `ForgotPasswordForm` zawężono do `SignInForm.tsx:20-24` z adnotacją o pominięciu `:25-27`.
