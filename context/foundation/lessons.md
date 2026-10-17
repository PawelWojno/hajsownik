# Lessons Learned

> Append-only register of recurring rules and patterns. Re-read at start by /10x-frame, /10x-research, /10x-plan, /10x-plan-review, /10x-implement, /10x-impl-review.

## RLS policies wrap current_household_id() in (select …)

- **Context**: supabase/migrations/20261008175223_household_foundation.sql:35,39 (policies households_select_own, household_members_select_own)
- **Problem**: Policies call `public.current_household_id()` directly, without `(select …)`. A SECURITY DEFINER function can't be inlined, so Postgres runs it once per row instead of once per query. On tables with one row per account it costs nothing, but the next tables (expenses, categories) will probably be copied from this migration and not from the template in plan.md.
- **Rule**: Every RLS policy that filters by household uses `household_id = (select public.current_household_id())`, never a bare function call, including on small tables, because migrations get copied.
- **Applies to**: supabase/migrations/** — every new or changed RLS policy that uses current_household_id() (or any other auth.uid()-based function)

## Wire up emailRedirectTo and a callback route for every Supabase Auth email

- **Context**: Any flow that triggers a Supabase Auth email (signUp confirmation, resetPasswordForEmail, magic link, email change) — `src/pages/api/auth/*` plus the dashboard URL Configuration.
- **Problem**: Without `emailRedirectTo`, Supabase falls back to the dashboard Site URL (default `localhost:3000`), and with PKCE the app needs a route that exchanges `?code` for a session. Signup confirmation links led nowhere even though the flow was marked "verified in production".
- **Rule**: Every call that sends an Auth email must pass `emailRedirectTo` built from the request origin, pointing at an existing route that calls `exchangeCodeForSession`, and that origin must be in the dashboard Redirect URLs allowlist. Verify by clicking the real email link, not by checking the API response.
- **Applies to**: plan, implement, impl-review

## Operacja tworząca potrzebuje ochrony przed duplikatem w UI i w bazie

- **Context**: Każda funkcja lub endpoint tworzący nową definicję z wieloma wierszami (cykliczne wydatki S-04, cykliczne przychody S-05), bez naturalnego klucza do zablokowania przed utworzeniem.
- **Problem**: Podwójny submit lub dwie karty wywołują tworzenie dwa razy: powstają dwie identyczne definicje i podwójna liczba wpisów, co zawyża sumy miesiąca, a zatrzymanie jednej zostawia drugą. Sama blokada przycisku nie chroni przed dwiema kartami ani ręcznym wywołaniem API.
- **Rule**: Każdą operację tworzącą zabezpiecz dwiema warstwami: wyłącz przycisk na czas żądania (stan `pending` w hooku) i dodaj w bazie częściowy indeks unikalny na parametrach definicji dla aktywnych wierszy (np. `where stopped_at is null`), z mapowaniem błędu 23505 na komunikat po polsku w API.
- **Applies to**: plan, plan-review, implement, impl-review

## Endpoint formularza z przekierowaniem potrzebuje GET, który tylko przekierowuje

- **Context**: src/pages/api/auth/*.ts (formularze POST z redirectem), src/lib/auth-get.ts
- **Problem**: Przeglądarka zapamiętuje endpoint POST jako pierwotny adres strony, na którą przekierował. „Wersja na komputer” w Brave/Chrome na Androidzie przeładowuje go jako GET, a trasa bez GET zwraca 404.
- **Rule**: Każdy nowy endpoint formularza HTML (method="POST" + redirect) eksportuje `GET = redirectOnGet` z `src/lib/auth-get.ts` albo własny GET, który tylko przekierowuje na stały adres, z `no-store`. GET nigdy nie wykonuje akcji ani nie czyta danych wejściowych.
- **Applies to**: plan, implement, impl-review

## Jasny motyw (:root) trzeba utrzymywać razem z ciemnym (.dark)

- **Context**: src/styles/global.css (`:root`), src/layouts/Layout.astro:14 (`<html class="dark">`)
- **Problem**: Aplikacja jest ciemna przez `<html class="dark">`, a jasne `:root` czeka na przełącznik motywu. Obecnie `:root` łączy białe `--background`/`--card` z ciemnymi `--cosmic-*` (tło `bg-cosmic`) i neutralnym `--muted-foreground`, więc usunięcie klasy `dark` dałoby nieczytelny miks. Jasne wartości nie były nigdy oglądane.
- **Rule**: Każdy nowy lub zmieniony token dostaje wartość w `:root` i w `.dark` w tej samej zmianie. Zmiana, która włącza jasny motyw lub przełącznik, najpierw sprawdza całe `:root` na stronie `/dev/dashboard-states` w obu motywach.
- **Applies to**: plan, implement, impl-review (każda zmiana w `src/styles/global.css`)

## Nowy wariant lub klasa responsywna Tailwinda sprawdzaj w przeglądarce, nie tylko bramkami

- **Context**: Każda zmiana UI w Tailwind 4, która dodaje wariant responsywny lub kontenerowy (breakpoint, `@container`, `@min-*`, `@max-*`, własny rozmiar kontenera). Przykład: src/components/home/PhoneSlide.astro (zmiana ui-home-page).
- **Problem**: Klasa, której Tailwind nie rozpoznaje (np. `@min-56:grid-cols-3`), jest po cichu pomijana: nie powstaje żadne CSS, a `npm run lint`, `check:ui` i `astro check` przechodzą. Układ po prostu nie reaguje na szerokość i błąd wychodzi dopiero przy oglądaniu strony (kategorie w telefonie były zawsze w 2 kolumnach, także na desktopie).
- **Rule**: Po dodaniu każdego nowego wariantu responsywnego lub kontenerowego sprawdź w przeglądarce (Playwright, computed style, np. `grid-template-columns`) co najmniej dwie szerokości po obu stronach progu; zielone bramki nie są dowodem, że klasa działa. Jeśli klasa nie działa, zdefiniuj nazwany rozmiar w `global.css` (np. `--container-*`) zamiast wartości arbitralnej, którą blokuje `check:ui`.
- **Applies to**: implement, impl-review, plan-review
