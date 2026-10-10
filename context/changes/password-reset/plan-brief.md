# Password reset — Plan Brief

> Full plan: `context/changes/password-reset/plan.md`
> Research: `context/changes/password-reset/research.md`

## What & Why

Użytkownik, który zapomniał hasła, może je zresetować mailem (FR-003, must-have), zamiast trwale tracić dostęp do danych finansowych gospodarstwa.

## Starting Point

Są logowanie, rejestracja z potwierdzeniem maila i trasa `/auth/callback` robiąca `exchangeCodeForSession`, ale zahardkodowana na `/dashboard`. Kodu resetu nie ma.

## Desired End State

Z ekranu logowania: „Forgot password?” → email → mail z linkiem → formularz nowego hasła → `/dashboard`, zalogowany nowym hasłem. Zły link daje czytelny komunikat i możliwość ponownej prośby.

## Key Decisions Made

| Decision | Choice | Why | Source |
| --- | --- | --- | --- |
| Wariant linku | Kod PKCE przez nową trasę `/auth/reset-callback` | Gotowy szablon maila, mniej konfiguracji; wybór użytkownika | Research / Plan |
| Trasa osobna zamiast `callback?next=` | `/auth/reset-callback` bez query w `redirectTo` | Allowlista Supabase dopasowuje URL; brak niepewności co do query | Plan |
| Bramka FR-001 | Klik w link = dowód skrzynki, bez blokady niepotwierdzonych | Supabase nie egzekwuje bramki; blokada wymaga service-role i ujawnia konta | Research / Plan |
| Po zmianie hasła | Zostaje zalogowany, `/dashboard` | Najkrótsza ścieżka, sesja i tak powstała z linku | Plan |
| Strażnik strony nowego hasła | Wymóg sesji (middleware) | `updateUser` zmienia tylko hasło zalogowanego | Research / Plan |
| Odpowiedź na prośbę | Zawsze ta sama karta „Check your email” | Brak enumeracji kont | Research / Plan |
| Testy | Smoke HTTP + ręczny obieg przez Inbucket | CI nie ma mailpit; bez zmian w CI | Plan |

## Scope

**In scope:** strona i endpoint prośby, trasa lądowania, strona i endpoint nowego hasła, link na stronie logowania, middleware, allowlista lokalna, kroki smoke, wpis w dashboardzie produkcji.
**Out of scope:** wariant token-hash, blokada niepotwierdzonych kont, zmiana hasła z ustawień, własny SMTP/szablony, mailpit w CI, zmiany `callback.ts`.

## Architecture / Approach

Formularz POST → `/api/auth/forgot-password` → `resetPasswordForEmail(redirectTo=origin/auth/reset-callback)` → mail → `/auth/reset-callback` (`exchangeCodeForSession`) → `/auth/update-password` → POST `/api/auth/update-password` (`updateUser`) → `/dashboard`.

## Phases at a Glance

| Phase | What it delivers | Key risk |
| --- | --- | --- |
| 1. Prośba o link | Strona, endpoint, link na signin, allowlista lokalna, smoke | Lokalna allowlista/restart Supabase |
| 2. Lądowanie i nowe hasło | Trasa callback, strona i endpoint zmiany hasła, strażnik, smoke | Link w innej przeglądarce (PKCE) — łagodzone komunikatem |
| 3. Produkcja | Redirect URL w dashboardzie, test prawdziwym mailem | Domena produkcyjna spoza repo; krok ręczny |

**Prerequisites:** lokalny Supabase (Docker), dostęp do dashboardu Supabase produkcji.
**Estimated effort:** ~2 sesje, 3 fazy.

## Open Risks & Assumptions

- Link otwarty w innej przeglądarce/urządzeniu nie zadziała (PKCE) — świadomie akceptowane, komunikat prowadzi do ponownej prośby.
- Zachowanie allowlisty dla `redirectTo` bez query założone z dokumentacji; potwierdza je ręczny test w fazie 1.
- Odstępstwo od dosłownego FR-001 (reset dla niepotwierdzonych kont auto-potwierdza je).
- Drobny wyciek istnienia konta przez błąd rate-limitu — akceptowany.

## Success Criteria (Summary)

- Użytkownik odzyskuje dostęp do konta bez udziału operatora.
- Lint, `astro check`, build i smoke zielone; obieg z prawdziwym mailem sprawdzony lokalnie i na produkcji.
