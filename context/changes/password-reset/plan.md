# Password reset Implementation Plan

## Overview

Użytkownik, który zapomniał hasła, prosi o link na mail (`/auth/forgot-password`), klika go i ustawia nowe hasło (`/auth/update-password`); po zmianie zostaje zalogowany i ląduje na `/dashboard`. Realizuje FR-003 (must-have), zamyka ryzyko trwałego zablokowania dostępu do danych finansowych gospodarstwa. Wariant linku: **kod PKCE** (`resetPasswordForEmail` + `exchangeCodeForSession`) przez nową trasę `/auth/reset-callback`. Bez zmian w bazie.

## Current State Analysis

- Brak jakiegokolwiek kodu resetu w `src/pages/auth`, `src/pages/api/auth`, `src/components/auth` (research.md, „Summary”).
- Wzorzec do skopiowania: `signup.ts` (zod, `emailRedirectTo` z `context.url.origin`, błędy przez `?error=`) + `callback.ts` (`exchangeCodeForSession`). Callback jest zahardkodowany na `/dashboard` (`src/pages/auth/callback.ts:31`) i ma komunikat błędu o potwierdzeniu maila (`:10-11`), więc nie nadaje się do resetu.
- Middleware: `PROTECTED_ROUTES` (startsWith) i `SIGNED_OUT_ONLY_ROUTES` (dokładne ścieżki) w `src/middleware.ts:4-6`.
- `supabase/config.toml:154-156`: `site_url` i `additional_redirect_urls` wskazują port 3000, nie 4321 (Astro). `enable_confirmations = false` (`:209`) — bramki FR-001 lokalnie nie da się przećwiczyć.
- CI (`ci.yml:41`) startuje Supabase z `-x ...mailpit...` — w CI nie ma skrzynki mailowej; smoke pokryje tylko powierzchnię HTTP.
- GoTrue (Context7): `Recover` wysyła mail bez sprawdzania `IsConfirmed()`, nieznany adres → 200; `recoverVerify` auto-potwierdza niepotwierdzone konto. Supabase nie egzekwuje bramki z FR-001.

## Desired End State

1. Z `/auth/signin` link „Forgot password?” prowadzi do formularza z samym adresem email.
2. Po wysłaniu formularza (poprawny format emaila) użytkownik zawsze widzi tę samą kartę „Check your email” — niezależnie od tego, czy konto istnieje.
3. Link z maila prowadzi przez serwer Supabase (`/auth/v1/verify`), który po kliknięciu przekierowuje na `/auth/reset-callback?code=...`; ta trasa w tej samej przeglądarce wymienia kod na sesję i otwiera `/auth/update-password`; po wpisaniu i potwierdzeniu nowego hasła (≥6 znaków) użytkownik ląduje na `/dashboard` i może się zalogować nowym hasłem.
4. Link wygasły, zużyty lub otwarty w innej przeglądarce kończy się na `/auth/forgot-password?error=<przyjazny komunikat>` z prośbą o nowy link.
5. Weryfikacja: `npm run lint`, `npx astro check`, `npm run build`, `npm run smoke` zielone; ręcznie — prawdziwy mail kliknięty lokalnie (Inbucket) i na produkcji.

### Key Discoveries:

- Link w innej przeglądarce/urządzeniu niż to, z którego poproszono o reset, nie zadziała (brak `code_verifier` w cookie) — udokumentowane w `callback.ts:26-27`; świadomie akceptowane przy wariancie PKCE (wybór użytkownika), łagodzone komunikatem błędu.
- Lekcja `lessons.md:12-17`: `redirectTo` z originu żądania, trasa robiąca `exchangeCodeForSession`, origin w allowliście Redirect URLs, weryfikacja kliknięciem w prawdziwy mail.
- Allowlista Supabase dopasowuje URL; bez query w `redirectTo` dopasowanie jest jednoznaczne, dlatego osobna trasa `/auth/reset-callback` zamiast `callback?next=...` (wzorzec z docs Next.js z `next` wymagałby dopasowania query w allowliście — niezweryfikowane).
- `updateUser({ password })` zmienia hasło aktualnie zalogowanego użytkownika, więc strażnikiem strony „nowe hasło” może być zwykły wymóg sesji.

## What We're NOT Doing

- Wariant token-hash (`/auth/confirm` + `verifyOtp` + edycja szablonu maila) — świadomie odrzucony na rzecz kodu PKCE; zamiana na niego kosztowałaby edycję szablonu `recovery` (lokalnie i w dashboardzie).
- Blokowania resetu dla niepotwierdzonych kont. Świadome odstępstwo od dosłownego FR-001: klik w link jest dowodem kontroli skrzynki (Supabase auto-potwierdza konto). Bez klucza service-role.
- Zmiany hasła z poziomu ustawień dla zalogowanego użytkownika, resetu przez SMS/OTP, własnego SMTP/szablonów maili.
- Poprawek istniejących tras (`signin.ts` bez zod, brak `prerender = false` w `signup.ts`).
- Wykrywania enumeracji kont przez rate-limit (`max_frequency`): przy błędzie Supabase pokazujemy ogólny błąd — drobny wyciek istnienia konta przez 429 akceptowany.
- Mailpit/Inbucket w CI; pełny obieg z linkiem testowany ręcznie.
- Zmian w `callback.ts` (rejestracja zostaje nietknięta).

## Implementation Approach

Dwie nowe strony Astro z wyspami React (wzorzec `SignInForm`/`SignUpForm`), trzy nowe trasy serwerowe (`forgot-password`, `reset-callback`, `update-password`) ze zod i `prerender = false`, drobne zmiany w middleware, `signin.astro` i `config.toml`. Teksty UI po angielsku (jak reszta stron `auth`). Praca w dwóch fazach kodowych (każda kończy się testowalnym efektem) i fazie wdrożeniowej (dashboard + kliknięcie w prawdziwy mail). Implementacja na branchu `feat/password-reset` + PR (polityka: kod → branch + PR).

## Phase 1: Prośba o link resetujący

### Overview

Użytkownik może poprosić o reset; mail z linkiem (po kliknięciu przekierowującym na `/auth/reset-callback`) trafia do Inbucket.

### Changes Required:

#### 1. Konfiguracja lokalna Supabase

**File**: `supabase/config.toml`

**Intent**: Pozwolić lokalnemu Supabase przyjmować `redirectTo` wskazujące na dev-serwer Astro (port 4321).

**Contract**: `additional_redirect_urls` zawiera dokładne URL-e `http://localhost:4321/auth/reset-callback`, `http://127.0.0.1:4321/auth/reset-callback` (oraz — dla spójności z lekcją — `.../auth/callback` na obu hostach). `site_url` bez zmian. Po zmianie wymagany `supabase stop && supabase start` (konfiguracja jest czytana przy starcie).

#### 2. Endpoint prośby o reset

**File**: `src/pages/api/auth/forgot-password.ts` (nowy)

**Intent**: Przyjąć email, poprosić Supabase o mail resetujący, nie zdradzać czy konto istnieje.

**Contract**: `export const prerender = false`, `POST`. zod: `z.email("Please enter a valid email address")`. Wywołanie `supabase.auth.resetPasswordForEmail(email, { redirectTo: `${context.url.origin}/auth/reset-callback` })`. Wyniki (redirecty 302): zły format → `/auth/forgot-password?error=<msg>`; brak klienta Supabase → `?error=Supabase is not configured` (jak `signup.ts:23-25`); błąd Supabase → `?error=We couldn't send the email right now. Please try again in a minute.`; sukces (także nieznany email) → `/auth/forgot-password?sent=1`.

#### 3. Strona i formularz

**Files**: `src/pages/auth/forgot-password.astro`, `src/components/auth/ForgotPasswordForm.tsx` (nowe)

**Intent**: Karta w stylu `signin.astro` z polem email; przy `?sent=1` ta sama strona pokazuje kartę „Check your email” (wzorzec `confirm-email.astro`).

**Contract**: formularz `method="POST" action="/api/auth/forgot-password"`, `noValidate`, walidacja emaila jak w `SignInForm.tsx:20-24` (puste pole i zły format); formularz nie ma pola hasła, więc blok `if (!password)` (`:25-27`) się nie przenosi; komponenty `FormField`/`SubmitButton`/`ServerError`. Odczyt `?error=` i `?sent=` po stronie Astro. Link „Back to sign in”.

#### 4. Wejście ze strony logowania i middleware

**Files**: `src/pages/auth/signin.astro`, `src/middleware.ts`

**Intent**: Dać użytkownikowi drogę do resetu; zalogowany nie ma po co wchodzić na formularz.

**Contract**: w `signin.astro` link `<a href="/auth/forgot-password">Forgot password?</a>` w stylu istniejącego linku „Sign up”. W `SIGNED_OUT_ONLY_ROUTES` dodać `"/auth/forgot-password"`.

#### 5. Smoke — powierzchnia HTTP prośby

**File**: `scripts/smoke.mjs`

**Intent**: Wykrywać regresje trasy bez skrzynki mailowej.

**Contract**: nowe kroki (przed rejestracją, użytkownik anonimowy): `GET /auth/forgot-password` → 200; `POST /api/auth/forgot-password` z `email: "not-an-email"` → 302 z prefiksem `/auth/forgot-password?error=`; `POST` z poprawnym, nieistniejącym emailem → 302 `/auth/forgot-password?sent=1`. Po kroku „signup creates account” (użytkownik zalogowany): `GET /auth/forgot-password` → 302 `/dashboard`.

### Success Criteria:

#### Automated Verification:

- Linting passes: `npm run lint`
- Type/Astro check passes: `npx astro check`
- Production build passes: `npm run build`
- Smoke passes against a running server with local Supabase: `npm run smoke`

#### Manual Verification:

- Po `supabase stop && supabase start` i `npm run dev` formularz z `/auth/forgot-password` dla istniejącego konta wysyła mail widoczny w Inbucket (`http://127.0.0.1:54324`); href linku wskazuje na lokalny serwer Supabase (`/auth/v1/verify`) i zawiera `redirect_to` równy zakodowanemu `http://localhost:4321/auth/reset-callback` (lub `127.0.0.1`, zależnie od hosta użytego w przeglądarce); `?code=` pojawia się dopiero po kliknięciu (faza 2). Jeśli zamiast tego `redirect_to` wskazuje `site_url` (port 3000), allowlista w `config.toml` nie zadziałała
- Dla nieistniejącego adresu użytkownik widzi dokładnie tę samą kartę „Check your email”
- Link „Forgot password?” jest widoczny na `/auth/signin`; zalogowany użytkownik wchodzący na `/auth/forgot-password` trafia na `/dashboard`

**Implementation Note**: Po fazie zatrzymać się na ręczne potwierdzenie. Checkboxy tej fazy żyją w `## Progress`.

---

## Phase 2: Lądowanie z linku i ustawienie nowego hasła

### Overview

Kliknięcie w link tworzy sesję i prowadzi do formularza nowego hasła; po zapisaniu użytkownik jest na `/dashboard`.

### Changes Required:

#### 1. Trasa lądowania z maila

**File**: `src/pages/auth/reset-callback.ts` (nowy)

**Intent**: Wymienić `?code` na sesję i skierować na formularz nowego hasła; przy porażce dać komunikat dopasowany do resetu.

**Contract**: `export const prerender = false`, `GET`. Struktura jak `callback.ts:7-31` (zod `{ code: z.string().min(1) }`, `createClient`, `exchangeCodeForSession`). Sukces → redirect `/auth/update-password`. Brak/zły `code` lub błąd wymiany → `/auth/forgot-password?error=` z tekstem w rodzaju: „This reset link is invalid, has expired, or was opened in a different browser than the one you requested it from. Please request a new link.” Brak klienta Supabase → `?error=Supabase is not configured`.

#### 2. Formularz nowego hasła

**Files**: `src/pages/auth/update-password.astro`, `src/components/auth/UpdatePasswordForm.tsx` (nowe)

**Intent**: Dwa pola (nowe hasło, potwierdzenie) w stylu `SignUpForm`.

**Contract**: wyspa React z walidacją klienta (wymagane, ≥6 znaków, zgodność haseł — komunikaty jak `SignUpForm.tsx:38-48`), `PasswordToggle`, `FormField`, `ServerError`; stała `MIN_PASSWORD_LENGTH = 6` zdefiniowana lokalnie (nie importować z `SignUpForm`, gdzie nie jest eksportowana). `method="POST" action="/api/auth/update-password"`; `?error=` z Astro.

#### 3. Endpoint zmiany hasła

**File**: `src/pages/api/auth/update-password.ts` (nowy)

**Intent**: Zmienić hasło zalogowanego (przez link) użytkownika.

**Contract**: `export const prerender = false`, `POST`. zod: `password` `min(6)`, `confirmPassword` równe `password` (komunikaty po angielsku, jak `signup.ts`). `createClient` → `auth.getUser()`; brak użytkownika → redirect `/auth/signin`. `auth.updateUser({ password })`; błąd (np. nowe hasło równe obecnemu) → `/auth/update-password?error=<error.message>`; sukces → `/dashboard`.

#### 4. Ochrona strony nowego hasła

**File**: `src/middleware.ts`

**Intent**: Strona i tak wymaga sesji; niezalogowany ma trafić na logowanie (które ma link „Forgot password?”).

**Contract**: `PROTECTED_ROUTES` dodać `"/auth/update-password"` (dopasowanie `startsWith` obejmuje stronę; endpoint API sam sprawdza użytkownika). `/auth/reset-callback` pozostaje poza obiema listami (musi działać dla zalogowanych i niezalogowanych).

#### 5. Smoke — nowe hasło i strażnicy

**File**: `scripts/smoke.mjs`

**Intent**: Pokryć w CI wszystko poza samym kliknięciem w mail, w tym prawdziwe `updateUser`.

**Contract**: smoke ma jeden słoik ciasteczek, a anonimowe okna są tylko dwa: przed „signup creates account” i po „signout clears session”. Dlatego kroki anonimowe wstawiamy przed „signup creates account” (obok kroków fazy 1), a nie obok kroków zalogowanych — z sesją `GET /auth/update-password` da 200 zamiast 302. Nowe kroki: anonimowo `GET /auth/update-password` → 302 `/auth/signin`; `GET /auth/reset-callback` (bez code) i `?code=invalid` → 302 z prefiksem `/auth/forgot-password?error=`; anonimowo `POST /api/auth/update-password` → 302 `/auth/signin`. Dla zalogowanego (po „signin accepts correct password”): `POST` z niezgodnymi hasłami → 302 prefiks `/auth/update-password?error=`; `POST` z poprawnym nowym hasłem (`newPassword` stała obok `password`) → 302 `/dashboard`. Na końcu pliku, po ostatnim kroku anonimowym: signin starym hasłem → prefiks `/auth/signin?error=`; signin nowym → `/dashboard`; signout → `/`.

### Success Criteria:

#### Automated Verification:

- Linting passes: `npm run lint`
- Type/Astro check passes: `npx astro check`
- Production build passes: `npm run build`
- Smoke (w tym zmiana hasła i logowanie nowym) passes: `npm run smoke`

#### Manual Verification:

- Pełny obieg w jednej przeglądarce: prośba → mail w Inbucket → klik w link (przekierowanie na `/auth/reset-callback?code=...`) → formularz nowego hasła → `/dashboard` → wylogowanie → logowanie nowym hasłem działa, starym nie
- Ten sam link kliknięty drugi raz oraz link otwarty w innej przeglądarce/oknie prywatnym kończy się na `/auth/forgot-password` z komunikatem o nieważnym linku
- Wejście wprost na `/auth/update-password` bez sesji przekierowuje na `/auth/signin`
- Hasło krótsze niż 6 znaków i niezgodne potwierdzenie pokazują błędy po stronie klienta

**Implementation Note**: Po fazie zatrzymać się na ręczne potwierdzenie.

---

## Phase 3: Produkcja i weryfikacja kliknięciem

### Overview

Odblokować flow na produkcji (Redirect URLs w dashboardzie) i wykonać wymaganą lekcją próbę z prawdziwym mailem.

### Changes Required:

#### 1. Redirect URLs w dashboardzie Supabase (krok ręczny)

**Intent**: Bez wpisu produkcyjny `redirectTo` zostanie zastąpiony Site URL i link nie zadziała (lekcja `lessons.md:12-17`).

**Contract**: Authentication → URL Configuration → Redirect URLs: dodać dokładny adres `https://<domena produkcyjna>/auth/reset-callback`. Domena nie jest zapisana w repo (`wrangler.jsonc` ma tylko nazwę workera `hajsownik`) — implementujący pyta użytkownika o adres. Sprawdzić przy okazji, czy potwierdzanie maili (`Confirm email`) jest włączone, i odnotować wynik.

#### 2. Notatka o odstępstwie od FR-001

**File**: `context/changes/password-reset/change.md` (sekcja Notes)

**Intent**: Zostawić ślad, że bramka „mail potwierdzony przed resetem” jest realizowana przez sam link (Supabase auto-potwierdza konto), a nie przez blokadę.

**Contract**: 2-3 zdania w `## Notes`; bez zmian w PRD.

### Success Criteria:

#### Automated Verification:

- CI na PR zielone (job `ci` i `smoke`): `gh pr checks`

#### Manual Verification:

- Na produkcji: prośba o reset dla prawdziwego konta, mail dociera, klik w link otwiera `/auth/update-password`, zmiana hasła kończy się na `/dashboard`
- Link w mailu zaczyna się od adresu produkcyjnego, nie od `localhost`/Site URL
- Odnotowane: czy potwierdzanie maili jest włączone w produkcji

**Implementation Note**: Faza kończy zmianę; po niej `/10x-impl-review` i `/10x-archive`.

---

## Testing Strategy

### Unit Tests:

- Brak nowych testów jednostkowych (repo ma smoke + pgTAP; logika tras to cienkie opakowania Supabase + zod).

### Integration Tests:

- `scripts/smoke.mjs`: kroki z faz 1-2 (powierzchnia HTTP, strażnicy, prawdziwe `updateUser` na zalogowanej sesji, logowanie nowym hasłem).

### Manual Testing Steps:

1. Lokalnie: pełny obieg przez Inbucket (faza 2).
2. Link zużyty / w innej przeglądarce → komunikat i możliwość ponownej prośby.
3. Produkcja: prawdziwy mail (faza 3).

## Performance Considerations

Brak istotnych; jedno wywołanie Supabase na trasę.

## Migration Notes

Brak zmian w bazie ani danych. Zmiana `config.toml` wymaga restartu lokalnego Supabase. Zmiana w dashboardzie produkcji jest krokiem ręcznym poza kodem.

## References

- Related research: `context/changes/password-reset/research.md`
- Wzorzec endpointu: `src/pages/api/auth/signup.ts:7-33`
- Wzorzec wymiany kodu: `src/pages/auth/callback.ts:7-31`
- Wzorzec formularzy: `src/components/auth/SignInForm.tsx`, `SignUpForm.tsx:29-76`
- Lekcja: `context/foundation/lessons.md:12-17`
- Roadmapa: `context/foundation/roadmap.md:119-130` (S-03, GitHub #3)

## Progress

> Convention: `- [ ]` pending, `- [x]` done. Append ` — <commit sha>` when a step lands. Do not rename step titles. See `references/progress-format.md`.

### Phase 1: Prośba o link resetujący

#### Automated

- [x] 1.1 Linting passes: `npm run lint` — cb2e004
- [x] 1.2 Type/Astro check passes: `npx astro check` — cb2e004
- [x] 1.3 Production build passes: `npm run build` — cb2e004
- [x] 1.4 Smoke passes against a running server with local Supabase: `npm run smoke` — cb2e004

#### Manual

- [x] 1.5 Formularz wysyła mail widoczny w Inbucket, a href linku zawiera `redirect_to` równy `{origin}/auth/reset-callback` (bez `?code=`, ten pojawia się dopiero po kliknięciu — faza 2) — cb2e004
- [x] 1.6 Dla nieistniejącego adresu użytkownik widzi dokładnie tę samą kartę „Check your email” — cb2e004
- [x] 1.7 Link „Forgot password?” widoczny na `/auth/signin`; zalogowany wchodzący na `/auth/forgot-password` trafia na `/dashboard` — cb2e004

### Phase 2: Lądowanie z linku i ustawienie nowego hasła

#### Automated

- [x] 2.1 Linting passes: `npm run lint` — 1d90fdd
- [x] 2.2 Type/Astro check passes: `npx astro check` — 1d90fdd
- [x] 2.3 Production build passes: `npm run build` — 1d90fdd
- [x] 2.4 Smoke (w tym zmiana hasła i logowanie nowym) passes: `npm run smoke` — 1d90fdd

#### Manual

- [x] 2.5 Pełny obieg w jednej przeglądarce (klik przekierowuje na `/auth/reset-callback?code=`) kończy się logowaniem nowym hasłem; stare hasło nie działa — 1d90fdd
- [x] 2.6 Link zużyty i link w innej przeglądarce kończą się komunikatem o nieważnym linku na `/auth/forgot-password` — 1d90fdd
- [x] 2.7 Wejście wprost na `/auth/update-password` bez sesji przekierowuje na `/auth/signin` — 1d90fdd
- [x] 2.8 Hasło krótsze niż 6 znaków i niezgodne potwierdzenie pokazują błędy po stronie klienta — 1d90fdd

### Phase 3: Produkcja i weryfikacja kliknięciem

#### Automated

- [x] 3.1 CI na PR zielone (job `ci` i `smoke`): `gh pr checks` — 458973c

#### Manual

- [x] 3.2 Na produkcji prawdziwy mail → klik → zmiana hasła → `/dashboard` — 458973c
- [x] 3.3 Link w mailu zaczyna się od adresu produkcyjnego, nie od `localhost`/Site URL — 458973c
- [x] 3.4 Odnotowane, czy potwierdzanie maili jest włączone w produkcji — 3d83545
