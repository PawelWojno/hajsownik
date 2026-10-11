# Signup confirmation page — Plan Brief

> Full plan: `context/changes/signup-confirmation-page/plan.md`

## What & Why

Po kliknięciu linku potwierdzającego rejestrację w przeglądarce bez PKCE verifiera (np. inne urządzenie) użytkownik widzi czerwony błąd na stronie logowania, choć e-mail jest już potwierdzony. Zastępujemy to stroną sukcesu.

## Starting Point

`src/pages/auth/callback.ts` przekierowuje błąd `exchangeCodeForSession` na `/auth/signin?error=…`. `confirm-email.astro` ma gotowy układ strony sukcesu.

## Desired End State

Nieudane auto-logowanie → `/auth/confirmed` (➡️ „Sign in to continue”, neutralny tekst bez deklaracji sukcesu + link „Go to sign in”). Brak/niepoprawny `code` nadal daje czerwony błąd.

## Key Decisions Made

| Decision | Choice                        | Why (1 sentence)                                                        |
| -------- | ----------------------------- | ----------------------------------------------------------------------- |
| Page     | New route `/auth/confirmed`   | Mirrors `confirm-email.astro`, clean URL, testable in smoke             |
| Scope    | Only exchange error           | Obecny `code` oznacza, że Supabase potwierdził e-mail; zepsute linki zostają błędem |
| Tests    | Smoke case + manual real link | Zgodne z `reset-callback` i regułą z lessons.md                         |

## Scope

**In scope:** nowa strona `confirmed.astro`, zmiana redirectu w `callback.ts`, przypadki w smoke.

**Out of scope:** gałąź brak/niepoprawny kod, `reset-callback`, szablony e-mail Supabase, baner sukcesu w SignInForm.

## Architecture / Approach

`callback.ts` na błąd wymiany kodu robi redirect na statyczną stronę Astro `/auth/confirmed`; nieużywana stała z komunikatem znika.

## Phases at a Glance

| Phase                               | What it delivers                  | Key risk                                             |
| ----------------------------------- | --------------------------------- | ---------------------------------------------------- |
| 1. Success page on failed auto-login | Strona + redirect + testy smoke  | Smoke nie odtworzy prawdziwego błędu PKCE            |

**Prerequisites:** brak. **Estimated effort:** ~1 krótka sesja, 1 faza.

## Open Risks & Assumptions

- Przy braku PKCE verifiera biblioteka rzuca błąd lokalnie, bez walidacji kodu — dowolny `?code=…` pokaże stronę sukcesu. Dlatego tekst nie deklaruje sukcesu („We couldn't sign you in automatically. If you've just confirmed your email, continue with your password.”); najgorszy skutek: logowanie niepotwierdzonym kontem zwróci jasny błąd.
- Założenie: `?code` w URL implikuje potwierdzony e-mail (komentarz w `callback.ts:9`, niezweryfikowane w docs Supabase).
- Odrzucono zawężenie do samego błędu braku verifiera: nie odróżnia dobrego kodu od złego.

## Success Criteria (Summary)

- Link otwarty w innej przeglądarce pokazuje stronę „Sign in to continue”, bez czerwonego banera.
- Ścieżka w tej samej przeglądarce nadal kończy się na `/dashboard`.
