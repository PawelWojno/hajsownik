---
date: 2026-10-11T13:39:30+02:00
researcher: Claude (Sonnet 5.5) dla Paweł Wojno
git_commit: cc47fe7dbd5b0395dbd613d88a731a154e858dc8
branch: master
repository: Hajsownik
topic: "recurring-expenses (S-04, FR-014/FR-015): co istniejąca baza kodu już robi i co ogranicza dodanie cyklicznych wydatków"
tags: [research, codebase, recurring-expenses, supabase, rls, expenses, month-screen, categories]
status: complete
last_updated: 2026-10-11
last_updated_by: Claude (Sonnet 5.5)
---

# Research: recurring-expenses (S-04) — stan bazy kodu

**Date**: 2026-10-11T13:39:30+02:00
**Researcher**: Claude (Sonnet 5.5) dla Paweł Wojno
**Git Commit**: cc47fe7dbd5b0395dbd613d88a731a154e858dc8
**Branch**: master (czyste drzewo w chwili startu sesji)
**Repository**: Hajsownik

## Research Question

Zakres wynika z `roadmap.md` (S-04, change-id `recurring-expenses`) i `prd.md` (FR-014, FR-015, a pośrednio FR-019): użytkownik definiuje cykliczny wydatek (kwota, kategoria, miesięczna częstotliwość, horyzont w miesiącach, domyślnie 12); aplikacja od razu tworzy tyle prawdziwych wpisów, po jednym na miesiąc, od miesiąca utworzenia definicji. Edycja kwoty = usunięcie przyszłych wygenerowanych wpisów i regeneracja; zatrzymanie = usunięcie przyszłych wpisów. Przypomnienie, gdy do końca horyzontu zostaje < 2 miesiące. Bez schedulera.

Pytanie badawcze: co w obecnej bazie kodu (dane, RLS, API, UI, daty, testy, CI) już istnieje, z czego S-04 skorzysta, a co go ogranicza lub wymaga rozstrzygnięcia przed planem? Badanie nie wybiera rozwiązania ani nie zawiera implementacji.

## Summary

1. **Nic w repozytorium nie przewiduje cykliczności.** Wyszukanie `recurr` w `src/`, `supabase/`, `scripts/` nie zwróciło trafień (sprawdzone bezpośrednio); agent warstwy danych potwierdził brak także `cykliczn*` w `supabase/**` i `src/**`. Brak tabeli definicji, brak kolumny łączącej wiersz `expenses` z definicją, brak typów w `src/types.ts`. Jedyny ślad to zarezerwowana nazwa `recurring_definitions` w planie `household-foundation` (`context/archive/2026-10-08-household-foundation/plan.md:31,39`).
2. **Tabela `expenses` ma dziś tylko polityki SELECT i INSERT.** Brak UPDATE/DELETE (`supabase/migrations/20261008233243_first_expense_and_income.sql:3` oraz polityki `expenses_select_own`, `expenses_insert_own`), a test pgTAP twierdzi, że UPDATE i DELETE dotykają 0 wierszy (`supabase/tests/database/expenses_income.test.sql:101-104`). FR-015 („usuń przyszłe wpisy") nie da się więc wykonać na obecnych uprawnieniach — potrzebna jest nowa polityka DELETE albo funkcja SQL.
3. **Brak jakiegokolwiek znacznika „wpis wygenerowany" na `expenses`.** Żeby usunąć „przyszłe wpisy tej definicji" i żeby S-06 mógł pokazać „ręczne vs. automatyczne" (`roadmap.md:160`), potrzebne jest powiązanie wiersza z definicją. Żaden wcześniejszy plan tego nie rozstrzygnął.
4. **Daty w przyszłości są dziś odrzucane przez warstwę API**, nie przez bazę: `dateField` ma `refine(value <= todayInWarsaw())` (`src/lib/validation.ts:19-22`); w bazie nie ma checku na `spent_on`. Wiersze wygenerowane po stronie SQL lub serwera nie przechodzą przez ten walidator. PRD traktuje wydatki z przyszłą datą jako nice-to-have/Non-Goal (FR-005, `prd.md:67`), więc plan musi jawnie uzgodnić to z FR-014, który wymaga wpisów w przyszłych miesiącach.
5. **Wzorzec atomowego zapisu wielu wierszy już istnieje**: funkcja SQL wołana przez `supabase.rpc` (`reorder_categories`, `supabase/migrations/20261009100000_category_management.sql:44-70`, SECURITY INVOKER, `set search_path = ''`). Klient Supabase JS w repo nie wykonuje transakcji wielozapytaniowych; „usuń + zregeneruj" musi być atomowe, co wskazuje na RPC. To wniosek z przeczytanego kodu, nie decyzja repo.
6. **Brak helpera dodawania miesięcy i reguły dnia miesiąca.** `src/lib/dates.ts` eksportuje tylko `todayInWarsaw`, `monthStartOf`, `currentMonthStart`, `isRealDate`, `formatMonthLabel` (sprawdzone grepem `export`). Ani PRD, ani wcześniejsze plany nie ustalają, na jaki dzień miesiąca wypada wpis ani jak obsłużyć dni 29–31.
7. **Ekran miesiąca nie listuje wydatków** — pokazuje tylko sumy z `month_summary` (`src/pages/dashboard.astro`, `src/components/month/MonthScreen.tsx`); lista/historia to S-06. W związku z tym S-04 nie ma gdzie „obejrzeć" wygenerowanych wpisów poza zmianą sum i własnym ekranem zarządzania definicjami.

## Detailed Findings

### Warstwa danych (migracje, RLS, funkcje, pgTAP)

Źródło: raport agenta „data layer" (czytał wszystkie 6 migracji, 3 pliki pgTAP, `config.toml`, `seed.sql`); kluczowe punkty zweryfikowałem bezpośrednio (nagłówek migracji, brak polityk UPDATE/DELETE, asercje pgTAP, brak `recurr`).

- `expenses`: `id uuid`, `household_id uuid not null default public.current_household_id()`, `category_id uuid not null`, `amount_minor bigint check (>0 and <=9999999999)`, `spent_on date not null`, `description text check (<=200)`, `created_at timestamptz` (`20261008233243_first_expense_and_income.sql:16-27`). Kwoty to całkowite grosze; data to `date` bez czasu. Brak `updated_at`.
- Złożony FK `(household_id, category_id) → categories(household_id, id)` bez `ON DELETE` (domyślnie NO ACTION), z komentarzem uzasadniającym, że zwykły FK omija RLS (`:24-26`). Wniosek: usunięcie kategorii, której używa choć jeden wydatek, kończy się błędem 23503; archiwizacja (`categories.archived_at`, `20261009100000_category_management.sql:5`) zostawia wiersze.
- Indeks `expenses_household_spent_on_idx (household_id, spent_on)` (`:29`). Miesiąc jest półotwartym zakresem na `spent_on` w `month_summary(p_month date)` (`:115-133`, SECURITY INVOKER, `grant` dla `authenticated`).
- RLS: polityki wszystkich tabel domenowych stosują `(select public.current_household_id())`, zgodnie z lekcją w `context/foundation/lessons.md:5-10`. RLS włączony, nie wymuszony (SECURITY DEFINER omija).
- `incomes` ma analogiczny kształt (`source` z listy, `received_on date`), też tylko SELECT/INSERT. To istotne dla S-05, który ma być „tym samym wzorcem" (`roadmap.md:154`).
- Funkcje: `current_household_id()` (DEFINER), `handle_new_user_household()` + `seed_default_categories()` (DEFINER, EXECUTE odebrane wszystkim rolom), `add_category`, `reorder_categories`, `month_summary` (INVOKER). Konwencja dla funkcji wołanych przez użytkownika: `set search_path = ''`, `revoke … from public, anon; grant … to authenticated`.
- pgTAP: `supabase/tests/database/{household_isolation,expenses_income,category_management}.test.sql`; plany 16/29/29; uruchamiane `supabase test db` w jobie `smoke` w CI (`.github/workflows/ci.yml:43-44` wg agenta). Fixture to dwóch prawdziwych użytkowników w `auth.users` (odpala trigger rejestracji), przełączanie roli przez `set local role authenticated` + `request.jwt.claims`. Zmiana liczby asercji wymaga zmiany `plan(N)`.
- Test `expenses_income.test.sql:101-104` zakłada default-deny dla UPDATE/DELETE na `expenses`. Jeśli S-04 doda politykę DELETE, ta asercja i `plan(29)` przestaną być prawdziwe. Precedens z category-management: nowe testy trafiają do nowego pliku (`context/archive/2026-10-09-category-management/plan.md:15` wg agenta).

### Warstwa aplikacji (API, serwisy, UI)

Źródło: raport agenta „app layer" (przeczytał pliki `src/**` w całości); punkty `validation.ts` i `dates.ts` zweryfikowałem sam.

- `POST /api/expenses` (`src/pages/api/expenses.ts`): `prerender=false`, 401 gdy brak `locals.user`, zod (`amountField`, `categoryId: z.uuid`, `dateField.optional()`, `descriptionField.optional()`), pojedynczy `supabase.from("expenses").insert(...)` bez `household_id` (domyślna wartość + RLS). Błąd 23503 → 400 „Wybierz kategorię z listy"; inne → 500 `SAVE_FAILED`. Odpowiedź budowana przez `buildSavedResponse` (`src/lib/services/month.ts:22-30`), która zawsze przelicza **bieżący** miesiąc i przy błędzie odczytu zwraca `summary: null` zamiast błędu.
- `amountField` zamienia tekst („12,50") na grosze przez `parseAmountToMinor` (`src/lib/money.ts`); definicja cykliczna może go użyć bez zmian.
- `/api/*` nie jest chronione przez middleware; każdy endpoint sam sprawdza `locals.user`. `PROTECTED_ROUTES = ["/dashboard", "/settings", "/auth/update-password"]` (`src/middleware.ts:4`, wg agenta) — strona pod `/settings/*` jest chroniona bez zmian.
- Ekran miesiąca: `src/pages/dashboard.astro` renderuje `MonthScreen` (`client:load`); tylko bieżący miesiąc (`currentMonthStart()`), bez parametru zapytania; „Zostaje" liczone w TS jako `income_total - expense_total` (`month.ts:14`). Kategorie dla formularza ładowane po stronie serwera: tylko aktywne (`archived_at IS NULL`, `order sort_order`).
- Formularz wydatku: `src/components/month/EntrySheet.tsx` (vaul Drawer; panel boczny od 768 px), hook `useEntrySubmit` z wąsko typowanym `kind: "expenses" | "incomes"`. Pole „horyzont" mogłoby trafić do sekcji „Więcej opcji" albo osobnego ekranu — decyzja produktowa, nie fakt z kodu.
- Najbliższy wzorzec ekranu zarządzania: `src/pages/settings/categories.astro` + `src/components/settings/CategoryManager.tsx` + `src/hooks/useCategoryActions.ts` + `src/pages/api/categories/{index,[id],reorder}.ts` + `src/lib/services/categories.ts` + `src/lib/category-http.ts`. Cechy: potwierdzenie usunięcia „w miejscu" (bez AlertDialog), każda mutacja zwraca świeżą pełną listę, 409/`null` → `window.location.reload()`, mapowanie kodów Postgresa na polskie komunikaty.
- shadcn/ui: zainstalowane tylko `button.tsx` i `drawer.tsx`; pola to surowe `<input>`/`<select>` ze stylem Tailwind (`fieldClass` zduplikowane w dwóch plikach).
- Nawigacja: `src/components/Topbar.astro` z rozwijanym „Ustawienia" zawierającym jeden link (`/settings/categories`); dodanie pozycji to jedna kolejna `<li>`.
- Brak komponentu banera użytkownika; `components/Banner.astro` służy tylko do błędów konfiguracji w Layout. Miejsca na przypomnienie o wygasającym horyzoncie: między `<h1>` a sekcją sum w `MonthScreen.tsx` (ok. l.31–35) albo nad przyciskami (ok. l.53).
- `src/types.ts` (39 linii): brak typów wiersza wydatku i typów cyklicznych; wiersze walidowane ad hoc schematami zod.

### Daty i strefa czasowa

- `todayInWarsaw()` itd. liczą wszystko w Europe/Warsaw, bo Workers działają w UTC (`src/lib/dates.ts:1-2`, komentarz; eksporty zweryfikowane). Daty to łańcuchy `YYYY-MM-DD`, nigdy `Date`. Strefa per gospodarstwo jest odłożona post-MVP (`roadmap.md:202`).
- Skutek dla S-04: „miesiąc utworzenia definicji" musi pochodzić z `todayInWarsaw()`/`currentMonthStart()`, a nie z `now()` bazy w UTC — inaczej w okolicy północy na przełomie miesięcy wpis wyląduje w złym miesiącu. (Wniosek z kodu; krawędź miesiąca była w S-01 sprawdzana ręcznie, nie automatycznie.)
- `month_summary` bierze całe miesiące kalendarzowe bez filtra „data <= dziś" (zakres `[początek miesiąca, +1 miesiąc)`). Zatem wiersze wygenerowane na późniejsze dni **bieżącego** miesiąca wchodzą do „Zostaje" od razu, a wiersze przyszłych miesięcy nie (wg `20261008233243_…sql:115-133` i review S-01 F3).

### Weryfikacja i CI

Źródło: raport agenta „prior decisions".

- Skrypty `package.json`: `lint`, `build`, `smoke`, `format`, `astro`. Brak skryptu `test`, brak vitest/playwright; plan S-01 mówi wprost, że runner JS nie istnieje (`context/archive/2026-10-08-first-expense-and-income/plan.md:47,304`). Arytmetykę dat można więc testować automatycznie tylko w pgTAP, jeśli generowanie jest w SQL.
- CI (`.github/workflows/ci.yml`): `ci` (lint, `astro check`, build), `smoke` (lokalny Supabase, `supabase test db`, build, preview, `scripts/smoke.mjs`), `deploy` (tylko push na master). **Job deploy nie stosuje migracji**; plany category-management wymagały `npx supabase db push` przed merge (`context/archive/2026-10-09-category-management/plan.md:205,232`; `context/deployment/deploy-plan.md:43`).
- `scripts/smoke.mjs` (292 linie wg agenta) pokrywa więcej niż autoryzację: `/dashboard` (brak `[object Object]`, tekst „Zostaje"), POST wydatku/przychodu z twardymi wartościami `left` (-1250, 98750), API kategorii. Ograniczenia dla kroku cyklicznego: twarde `left` zależą od kolejności kroków; krok anonimowego 401 dla wydatków musi zostać ostatni (`smoke.mjs:266-267`). `/settings/categories` jest sprawdzane tylko jako przekierowanie anonimowe.
- Opisy w `CLAUDE.md`/`infrastructure.md` („smoke tylko auth") są nieaktualne względem skryptu.
- `wrangler.jsonc`: `nodejs_compat`, `observability.enabled: true`, brak bloku `limits`/`placement`. Brak instrumentacji CPU w repo; czas CPU można odczytać tylko z panelu Cloudflare.

## Code References

- `supabase/migrations/20261008233243_first_expense_and_income.sql:3` — „Writes are insert-only … default-deny until S-06"
- `supabase/migrations/20261008233243_first_expense_and_income.sql:16-27` — definicja `expenses` (grosze, `spent_on date`, złożony FK)
- `supabase/migrations/20261008233243_first_expense_and_income.sql:115-133` — `month_summary` (zakres miesiąca, INVOKER)
- `supabase/migrations/20261009100000_category_management.sql:5` — `archived_at` na `categories`
- `supabase/migrations/20261009100000_category_management.sql:44-70` — `reorder_categories` (wzorzec atomowego RPC)
- `supabase/tests/database/expenses_income.test.sql:101-104` — asercje default-deny UPDATE/DELETE na `expenses`
- `src/lib/validation.ts:19-22` — `dateField` odrzuca daty późniejsze niż dziś (Warsaw)
- `src/lib/dates.ts:14-38` — pełny zestaw helperów dat (brak dodawania miesięcy)
- `src/lib/services/month.ts:10-30` — `getMonthSummary`, `buildSavedResponse`
- `src/pages/api/expenses.ts` — wzorzec cienkiego endpointu (401, zod, mapowanie błędów)
- `src/pages/dashboard.astro`, `src/components/month/MonthScreen.tsx` — ekran miesiąca (tylko sumy)
- `src/components/settings/CategoryManager.tsx`, `src/hooks/useCategoryActions.ts`, `src/pages/api/categories/` — wzorzec ekranu zarządzania
- `src/components/Topbar.astro` — menu Ustawienia; `src/middleware.ts:4` — `PROTECTED_ROUTES`
- `context/foundation/prd.md:93-97` — FR-014/FR-015 z blokami Socrates; `:110` — FR-019
- `context/foundation/infrastructure.md:66,96` — ryzyko 10 ms CPU dla hurtowego generowania i zalecany pomiar

## Architecture Insights

- **Wzorzec warstw**: migracja SQL + pgTAP → serwis/endpoint (zod, 401, mapowanie błędów) → hook → komponent React. Kolejność faz w poprzednich planach: baza z testami, API, UI, smoke/housekeeping.
- **Izolacja gospodarstw przez złożone FK + RLS z `(select …)`**; każda nowa tabela (definicje) i nowy link `expenses → definicja` powinny kopiować ten wzorzec (lekcja w `lessons.md`; precedens `plan.md:33-34` w first-expense-and-income wg agenta).
- **Funkcje „nie do wywołania przez użytkownika"** tracą EXECUTE dla wszystkich ról; funkcje użytkownika dostają `revoke … from public, anon; grant … to authenticated`.
- **S-05 ma być tym samym mechanizmem na drugiej encji** (`roadmap.md:154`, `prd.md:101`) — projekt S-04 wpływa na kształt przychodów, co jest uwagą z roadmapy, a nie wymogiem technicznym wynikającym z kodu.
- Hurtowe generowanie: infrastructure.md zaleca „pomierz przy pierwszym użyciu, w razie potrzeby zbatchuj inserty" (`:96`). Pojedyncze wywołanie RPC (generowanie w SQL) lub jeden bulk insert to jedno podzapytanie zamiast 12 sekwencyjnych — to wniosek agentów z lektury, repo nie zawiera na ten temat decyzji.

## Historical Context (from prior changes)

- `context/archive/2026-10-08-household-foundation/plan.md:31,39` — zarezerwowana nazwa `recurring_definitions`; kontrakt: `household_id` + polityka z `(select current_household_id())`. Stan: **częściowo aktualne** — nazwa jest tylko sugestią, żadna tabela nie powstała.
- `context/archive/2026-10-08-first-expense-and-income/plan.md` — kwoty jako grosze (`:51-52`), data `date` + Warsaw (`:36-37`), brak runnera testów JS (`:47,304`). Stan: obowiązuje.
- `context/archive/2026-10-08-first-expense-and-income/reviews/impl-review.md` F1 — insert zatwierdzony przed odczytem sum; wybrano wariant „200 z `summary: null`", wariant B (jedna funkcja SQL zapisująca i zwracająca sumy) odrzucony. Stan: obowiązuje dla pojedynczego wpisu; przy wielu wierszach częściowa porażka byłaby gorsza (ocena agenta).
- `context/archive/2026-10-09-category-management/plan.md:36` i `reviews/{plan-review.md:85,impl-review.md:107-115}` — `POST /api/expenses` celowo nie odrzuca zarchiwizowanej kategorii; FR-009 egzekwuje tylko UI; „revisit in S-06". Stan: **nierozstrzygnięte dla definicji cyklicznych** — nic nie mówi, czy definicja może wskazywać kategorię zarchiwizowaną po utworzeniu.
- `context/foundation/shape-notes.md:34-35` — decyzja o stałym horyzoncie materializowanym z góry, edycja = usuń-i-zregeneruj, przypomnienie < 2 miesiące. Stan: obowiązuje; „przedłuż" nie ma własnego FR.
- `context/foundation/roadmap.md:132-143` — S-04: Unknowns „—", Risk: implementować dokładnie stały horyzont. Uwaga: tabela handoff (`:179`) ma nieaktualne „Blocked on S-01", bo S-01 jest zrobione.
- GitHub #5 jest wspomniany tylko w `roadmap.md:143`; treści issue w repo nie ma.

## Related Research

Brak innych dokumentów `research.md` w `context/changes/**`; w archiwum istnieją `research.md` innych zmian (m.in. first-expense-and-income), nie dotyczące cykliczności.

## Open Questions

Sprawy produktowe/projektowe niewynikające z kodu, do rozstrzygnięcia w `/10x-plan` (kolejność wg wpływu na kształt rozwiązania):

1. **Dzień miesiąca wpisu**: dzień utworzenia definicji, 1. dzień miesiąca, czy dzień wybrany przez użytkownika? Jak traktować dni 29–31 (przycięcie do ostatniego dnia)? PRD mówi tylko „jeden na miesiąc, od miesiąca utworzenia".
2. **Wpis w miesiącu utworzenia**: jeśli dzień wypada później niż dziś, wchodzi do „Zostaje" bieżącego miesiąca od razu (patrz `month_summary`); czy to zamierzone? Dotyczy też konfliktu z regułą „bez przyszłych dat" (FR-005 / `dateField`).
3. **Definicja „przyszłych" wpisów** dla FR-015: `spent_on > dziś` (Warsaw) czy `spent_on >= początek bieżącego miesiąca`? Od tego zależy, czy wpis bieżącego miesiąca znika przy zatrzymaniu.
4. **Mechanizm usuwania**: nowa polityka DELETE na `expenses` (zawężona do wierszy z linkiem do definicji, żeby nie wejść w zakres S-06 — ostrzeżenie agenta) czy funkcja SQL; w obu wariantach trzeba zmienić pgTAP (`plan(29)` + asercje `:101-104`) lub dodać nowy plik testowy.
5. **Model danych**: osobna tabela definicji dla wydatków i przychodów, czy wspólna z `kind` (S-05 ma być tym samym wzorcem); kolumna linkująca w `expenses` (i `incomes`); zachowanie FK przy usunięciu definicji (agent sugeruje nieusuwanie wpisów kaskadowo — to jego sugestia, nie fakt z repo).
6. **Zarchiwizowana kategoria** po utworzeniu definicji: kolejne (już wygenerowane) wpisy ją zachowują, ale edycja z regeneracją — czy ma blokować, czy dopuszczać archiwalną kategorię?
7. **Przypomnienie (< 2 miesiące)**: jest w bloku Socrates, nie w osobnym FR ani w „Outcome" slice'a; czy wchodzi do S-04? I czym jest „przedłuż" (nowy FR nie istnieje)?
8. **Limity**: maksymalny horyzont (infrastructure.md: „up to 12-month"; PRD: „e.g. default 12") oraz maksymalna liczba definicji na gospodarstwo.
9. **Pomiar CPU Workera**: brak instrumentacji w repo; zalecenie z infrastructure.md to pomiar przy pierwszym użyciu w panelu Cloudflare. Nie zmierzono nic w tym badaniu (nie uruchamiano buildów ani testów).
10. **Smoke**: jak dopisać krok cykliczny bez zmiany twardych wartości `left` i bez naruszenia kolejności kroku 401.
11. **Wdrożenie**: migracje trzeba wypchnąć (`db push`) przed merge, bo job deploy ich nie stosuje.

### Zakres i luki badania

- Sprawdzone: `supabase/migrations/**` (6 plików), `supabase/tests/database/*` (3 pliki), `src/**` (całość wg agenta), `context/archive/**` (plany i reviewy czterech zmian, pozostałe tylko grepem), `context/foundation/*`, `scripts/smoke.mjs`, `.github/workflows/ci.yml`, `wrangler.jsonc`, `package.json`.
- Niesprawdzone: żadne polecenie nie było uruchamiane (brak `supabase db reset`, testów, buildów) — zgodność żywej bazy produkcyjnej z migracjami nie jest potwierdzona; nie czytano w całości `household_isolation.test.sql`, `EntrySheet.tsx` (wg agentów), planów password-reset i signup-confirmation (poza grepem), `components.json` i `global.css`.
- Numery linii z raportów agentów, których osobiście nie otwierałem (m.in. `ci.yml:43-44`, `smoke.mjs:266-267`, `MonthScreen.tsx` l.31–53, `middleware.ts:4`, `plan.md` w archiwum), traktuj jako wskazówki do sprawdzenia przed cytowaniem w planie.
