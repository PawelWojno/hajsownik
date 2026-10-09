<!-- PLAN-REVIEW-REPORT -->
# Plan Review: First expense + income, month "zostaje"

- **Plan**: context/changes/first-expense-and-income/plan.md
- **Mode**: Deep
- **Date**: 2026-10-08
- **Verdict**: REVISE → SOUND after triage (9/9 findings fixed; F2 downgraded to OBSERVATION and F8 fix changed after verification against the code)
- **Findings**: 0 critical  5 warnings  5 observations (after verification; F10 added by the user during triage)

## Verdicts

| Dimension | Verdict |
|-----------|---------|
| End-State Alignment | WARNING |
| Lean Execution | WARNING |
| Architectural Fitness | PASS |
| Blind Spots | WARNING |
| Plan Completeness | WARNING |

## Grounding

8/8 paths ✓, 5/5 symbols ✓, brief↔plan ✓

Sprawdzone ścieżki: `src/pages/api/auth/signin.ts`, `src/pages/dashboard.astro`, `scripts/smoke.mjs`, `context/foundation/roadmap.md`, `supabase/tests/database/household_isolation.test.sql`, `src/middleware.ts`, `src/lib/supabase.ts`, `supabase/migrations/20261008200802_trigger_trim_whitespace.sql`. Symbole: `current_household_id`, `handle_new_user_household`, `createClient`, `PROTECTED_ROUTES`, `ServerError`. Middleware puszcza `/api/expenses` i `/api/incomes` dalej (chroni tylko `/dashboard`). Rola `authenticated` nadal może wykonać `current_household_id()`.

## Findings

### F1 — Kwota w JSON nie ma jednego formatu

- **Severity**: ⚠️ WARNING
- **Impact**: 🔎 MEDIUM — real tradeoff; pause to reason through it
- **Dimension**: Plan Completeness
- **Location**: Implementation Approach + Phase 2
- **Detail**: Jedno zdanie mówi, że UI parsuje „12,50” / „12.50” na grosze. Faza 2 jednocześnie stawia `parseAmountToMinor(input: string)` po stronie serwera i każe zodowi walidować `amount`, bez nazwy pola i bez typu. Jeśli UI wyśle 1250 (grosze), a API znowu pomnoży przez 100, „zostaje” będzie stukrotnie za duże — i test „amount > 0” tego nie złapie.
- **Fix A ⭐ Recommended**: Pole `amount` to surowy string („12,50” albo „12.50”); parsuje wyłącznie API
  - Strength: Jedna konwersja na granicy zaufania; 400 dla kwoty 0 zostaje w zodzie, tam gdzie jest ręczny test fazy 2.
  - Tradeoff: UI, które chce zablokować Zapisz przed requestem, i tak woła ten sam helper, ale wysyła string.
  - Confidence: HIGH — w repozytorium walidacja mieszka w endpoincie (`signup.ts`), a nie w przeglądarce.
  - Blind spot: None significant.
- **Fix B**: UI wysyła `amountMinor` (integer); zod sprawdza int > 0 i ≤ 9999999999
  - Strength: Format na łączu = format w kolumnie `amount_minor`.
  - Tradeoff: Serwer nie odróżni „12,50” od „1250 zł”; reguła dwóch miejsc po przecinku żyje tylko w UI.
  - Confidence: MEDIUM — zgodne ze zdaniem „the UI parses”, sprzeczne z tym, że helper jest w fazie API.
  - Blind spot: Nie sprawdzone, czy szybkie wpisywanie z klawiatury numerycznej w ogóle przejdzie przez helper przed fetch.
- **Decision**: FIXED via Fix A (+ keystroke filter in the amount field, input is plain text, not type="number")

### F2 — Lista 12 kategorii nie jest w PRD

- **Severity**: ⚠️ WARNING
- **Impact**: 🔎 MEDIUM — real tradeoff; pause to reason through it
- **Dimension**: Blind Spots
- **Location**: Phase 1 — Default categories; plan-brief, tabela decyzji
- **Detail**: Brief uzasadnia listę zdaniem „Matches PRD's 12”. PRD (FR-006) podaje tylko liczbę 12, bez nazw. Jedyne wyliczenie jest w `opis_aplikacji.txt` i jest przykładowe („np.”): mieszkanie/dom, żywność, samochód, transport, dzieci, zdrowie, rozrywka, subskrypcje, ubrania, zakupy, kredyty, ubezpieczenia, inne — 13 pozycji, inne nazwy. Roadmap S-01 nadal ma to jako Unknown właściciela „user”, do potwierdzenia przed shippingiem. Migracja z backfillem na produkcji i pgTAP „in order” zamrożą nazwy.
- **Fix A ⭐ Recommended**: Zostaw te 12, popraw uzasadnienie i w fazie 4 zamknij Unknown w roadmapie
  - Strength: Lista jest już decyzją w briefie; źródłowy „np.” nie jest specyfikacją, a 13 pozycji nie spełnia „12” z PRD.
  - Tradeoff: Wypadają subskrypcje, kredyty, ubezpieczenia, zakupy i samochód, dopóki nie ma S-02.
  - Confidence: MEDIUM — decyzja jest zapisana, ale nie ma śladu, że użytkownik widział rozjazd ze źródłem.
  - Blind spot: Nie wiem, czy ta dwunastka była świadomie wybrana w rozmowie planistycznej, czy dopisana jako „rozsądny default”.
- **Fix B**: Podmień listę na przykłady z `opis_aplikacji.txt` przed migracją
  - Strength: Nazwy biorą się z jedynego wyliczenia w materiałach produktu.
  - Tradeoff: To 13 pozycji oznaczonych „np.”, więc pgTAP i FR-006 („12”) trzeba świadomie zmienić.
  - Confidence: LOW — „np.” nie wygląda na zamkniętą listę.
  - Blind spot: Które pozycje użytkownik naprawdę chce w pierwszym dniu, nie było sprawdzane poza tym plikiem.
- **Decision**: FIXED (brief rationale corrected; Phase 4 closes the S-01 Unknown in the roadmap)

### F3 — Smoke nie potrafi zassertować nowego kontraktu

- **Severity**: ⚠️ WARNING
- **Impact**: 🔎 MEDIUM — real tradeoff; pause to reason through it
- **Dimension**: Plan Completeness
- **Location**: Phase 4 — Smoke
- **Detail**: `scripts/smoke.mjs` `request()` wysyła tylko form-urlencoded i zwraca `{ status, location }` — body odpowiedzi jest odrzucane (linie 23–36). Faza 4 każe zrobić POST JSON i zassertować `left`, oraz „pick the simplest at implementation time” dla id kategorii. Dodatkowo oczekiwane `location: "/"` i tak przejdzie dla `/dashboard`, bo matcher używa `startsWith` (linie 64–66). Samo „zaktualizuj expected redirect” nie wymusza zmiany helpera.
- **Fix A ⭐ Recommended**: Rozszerz `request()` o JSON i body; id kategorii z atrybutu na `/dashboard`
  - Strength: Skrypt zostaje bez zależności i bez `SUPABASE_URL`; CI odpala go tylko z `BASE_URL`.
  - Tradeoff: Faza 3 musi wystawić stabilny atrybut, np. `data-category-id`, inaczej smoke parsuje HTML.
  - Confidence: HIGH — `package.json` trzyma smoke jako `node scripts/smoke.mjs`, a job CI nie wstrzykuje URL-a Supabase do skryptu.
  - Blind spot: None significant.
- **Fix B**: Smoke czyta kategorię z PostgREST sesją użytkownika
  - Strength: Brak haczyka testowego w HTML dashboardu.
  - Tradeoff: Ciasteczko `@supabase/ssr` jest pocięte (`sb-…-auth-token`); parsowanie JWT bez zależności jest kruche, a skrypt musi znać URL API.
  - Confidence: LOW — tego formatu ciasteczka plan nie opisuje, a lokalny smoke go nie używa.
  - Blind spot: Nie sprawdzone, jak dokładnie `@supabase/ssr` składa chunki w tej wersji.
- **Decision**: FIXED via Fix A

### F4 — Dwa kształty odpowiedzi POST

- **Severity**: ⚠️ WARNING
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Plan Completeness
- **Location**: Phase 2 — Expense endpoint, Intent vs Contract
- **Detail**: Intent zwraca `{ summary, savedMonth }`. Contract i faza 3 używają `{ summary, inCurrentMonth }`. Od tego booleanu zależy komunikat „Zapisano w <miesiąc>”. Plan nie mówi, kiedy flaga jest true.
- **Fix**: Zostaw `{ summary, inCurrentMonth }`. Flaga jest true, gdy data wpisu wpada w `[currentMonthStart(), następny miesiąc)` liczonym w Europe/Warsaw. Nazwę miesiąca w komunikacie formatuje klient z daty, którą użytkownik wysłał. Usuń `savedMonth` z Intent.
- **Decision**: FIXED

### F5 — Źródła dochodu bez polskich znaków

- **Severity**: ⚠️ WARNING
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: End-State Alignment
- **Location**: Phase 1 — tabela `incomes`
- **Detail**: FR-012 wymienia: wynagrodzenie, działalność, świadczenia, wynajem, inne. Kontrakt kolumny `source` zapisuje `dzialalnosc` i `swiadczenia`. Select w panelu ma użyć „tych 5 wartości”, więc użytkownik może zobaczyć ASCII. Baza już trzyma polskie znaki (`Mój dom` w triggerze).
- **Fix**: W CHECK i w zodzie użyj pisowni z FR-012: `działalność`, `świadczenia`.
- **Decision**: FIXED

### F6 — Zdanie o REVOKE EXECUTE jest szersze niż migracja

- **Severity**: ℹ️ OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Blind Spots
- **Location**: Current State Analysis
- **Detail**: Plan mówi, że F-01 zabrał EXECUTE helperom DEFINER także roli `authenticated`. W `20261008200524_revoke_function_execute.sql` tak jest tylko dla `handle_new_user_household()`. `current_household_id()` jest zdjęte z `public` i `anon`; `authenticated` zostaje, bo polityki RLS wołają tę funkcję tą rolą. DEFAULT `household_id` na `expenses` / `incomes` też na tym stoi. Kontrakt fazy 1 dla `seed_default_categories` i `month_summary` jest już poprawny — mylące jest tylko zdanie wstępne.
- **Fix**: Popraw zdanie: nowa funkcja DEFINER, której nie woła użytkownik (`seed_default_categories`), traci EXECUTE dla public/anon/authenticated. `current_household_id()` zostaje wykonywalne dla `authenticated`.
- **Decision**: FIXED

### F7 — Faza 4 dopisuje do roadmapy wpisy, które już tam są

- **Severity**: ℹ️ OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Lean Execution
- **Location**: Phase 4 — Roadmap
- **Detail**: `context/foundation/roadmap.md` ma już status S-01 `planning` (linia 45 i 104) oraz oba wpisy Parked: pasek budżetu i strefę czasową (linie 201–202). Dosłowne „Add to Parked” zduplikuje bullet.
- **Fix**: Zamień krok na „sprawdź, że oba wpisy i status `planning` już są; nie dopisuj drugi raz”.
- **Decision**: FIXED

### F8 — Bramka deployu szuka tekstu, który faza 3 usuwa

- **Severity**: ℹ️ OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Blind Spots
- **Location**: Phase 3 — `dashboard.astro`
- **Detail**: `context/deployment/deploy-plan.md` linia 54 każe po sign-in potwierdzić, że `/dashboard` pokazuje `Welcome, <email>`. Ten tekst jest dziś w `src/pages/dashboard.astro` (linia 14). Faza 3 usuwa placeholder.
- **Fix**: W fazie 4 zaktualizuj to zdanie: po sign-in widać Przychody, Wydatki i Zostaje, nie `Welcome, <email>`.
- **Decision**: FIXED (annotation in plan; deploy-plan.md left untouched as audit trail)

### F9 — Jedna migracja, dwie nazwy pliku

- **Severity**: ℹ️ OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Plan Completeness
- **Location**: Phase 1 — Overview vs Changes Required
- **Detail**: Overview: `supabase/migrations/<ts>_expenses_income_categories.sql`. Changes: `supabase/migrations/<timestamp>_first_expense_and_income.sql`.
- **Fix**: Zostaw jedną nazwę: `YYYYMMDDHHmmss_first_expense_and_income.sql`, z timestampem późniejszym niż `20261008200802`.
- **Decision**: FIXED

### F10 — Niespójny język interfejsu

- **Severity**: ⚠️ WARNING
- **Impact**: 🔎 MEDIUM — real tradeoff; pause to reason through it
- **Dimension**: End-State Alignment
- **Location**: Phase 3 — Month screen; whole app
- **Detail**: Zgłoszone przez użytkownika, nie wykryte w pierwszym przeglądzie. Nowy ekran miesiąca jest po polsku, a Topbar, strona startowa, formularze auth i `<html lang="en">` w `Layout.astro` są po angielsku.
- **Fix**: Wszystko poza auth po polsku w S-01 (Layout `lang="pl"`, Topbar, Welcome, błędy nowych endpointów); auth do osobnej zmiany zapisanej w Parked.
- **Decision**: FIXED (Phase 3 change #3, criterion 3.10; roadmap Parked entry)
