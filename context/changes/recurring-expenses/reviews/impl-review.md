<!-- IMPL-REVIEW-REPORT -->
# Implementation Review: Cykliczne wydatki (S-04)

- **Plan**: context/changes/recurring-expenses/plan.md
- **Scope**: Full plan
- **Reviewed phases**: 1, 2, 3, 4
- **Date**: 2026-10-11
- **Verdict**: NEEDS ATTENTION
- **Findings**: 0 critical 2 warnings 6 observations

Uwagi do zakresu: faza 4 ma otwarte tylko kroki produkcyjne 4.7 (`db push`) i 4.8 (pomiar CPU po deployu); jej kod jest kompletny i został przejrzany. Bramki automatyczne uruchomione podczas przeglądu: lint, `astro check` (0 błędów), build, `supabase db reset` + `supabase test db` (4 pliki, 161 asercji), smoke na serwerze deweloperskim (wszystkie kroki) — wszystkie zielone.

## Verdicts

| Dimension | Verdict |
|-----------|---------|
| Plan Adherence | PASS |
| Scope Discipline | WARNING |
| Safety & Quality | WARNING |
| Architecture | PASS |
| Pattern Consistency | WARNING |
| Success Criteria | WARNING |

## Findings

### F1 — Kategorii z samą zatrzymaną definicją nie da się usunąć, a komunikat kłamie

- **Severity**: ⚠️ WARNING
- **Impact**: 🔎 MEDIUM — real tradeoff; pause to reason through it
- **Dimension**: Safety & Quality
- **Location**: supabase/migrations/20261011130000_recurring_expenses.sql:28 (FK `(household_id, category_id) → categories`); src/lib/category-http.ts:15-16
- **Detail**: Złożony FK z `recurring_expenses` do `categories` nie ma `ON DELETE`. Zatrzymana definicja zostaje w tabeli (miękkie usunięcie), jest niewidoczna na liście i nie ma polityki DELETE. Odtworzone w lokalnej bazie: definicja z dniem 31 na 1 miesiąc (jedyny wpis po dziś), zatrzymanie usuwa wpis, kategoria ma 0 wydatków, a `delete from categories` kończy się błędem 23503 z `recurring_expenses_household_id_category_id_fkey`. Użytkownik zobaczy „Ta kategoria ma wydatki. Zarchiwizuj ją zamiast usuwać." i nie ma jak usunąć blokady. Migracja nie jest jeszcze na produkcji, więc poprawka w tej samej migracji jest tania.
- **Fix A ⭐ Recommended**: FK definicji do kategorii z `ON DELETE CASCADE` + test pgTAP
  - Strength: kategoria z prawdziwymi wydatkami nadal jest chroniona przez FK z `expenses`, więc kaskada usuwa tylko definicje bez żadnych wpisów w tej kategorii (zatrzymane lub z ręcznie usuniętymi wpisami).
  - Tradeoff: usunięcie kategorii usuwa też aktywną definicję, której wszystkie wpisy ktoś wcześniej usunął ręcznie (możliwe dopiero po S-06); FK `expenses → recurring_expenses` nie przeszkadza, bo takie definicje nie mają wpisów.
  - Confidence: HIGH — scenariusz odtworzony, a ochrona przez FK z `expenses` jest już testowana w pgTAP.
  - Blind spot: zachowanie po S-06 (edycja kategorii pojedynczego wpisu) nie było rozważane.
- **Fix B**: zostawić FK, a w usuwaniu kategorii najpierw kasować zatrzymane definicje bez wpisów (funkcja SQL) i rozróżnić komunikat
  - Strength: aktywne definicje nigdy nie znikają przy usuwaniu kategorii.
  - Tradeoff: nowa funkcja SQL, zmiana serwisu kategorii (poza zakresem S-04) i dodatkowe mapowanie błędu.
  - Confidence: MEDIUM — więcej ruchomych części w kodzie kategorii.
  - Blind spot: nie sprawdzono, jak to wpłynie na testy `category_management.test.sql`.
- **Decision**: FIXED via Fix A (ON DELETE CASCADE na FK definicji do kategorii; pgTAP: kategoria z samą definicją daje się usunąć i kaskada usuwa definicję, kategoria z wpisami nadal 23503; plan(89); opis w kontrakcie Phase 1)

### F2 — Dwa kroki smoke nie mogą się nie udać

- **Severity**: ⚠️ WARNING
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Success Criteria
- **Location**: scripts/smoke.mjs:253-262 oraz :234-240
- **Detail**: Krok „recurring settings page renders" sprawdza tekst „Cykliczne wydatki", który jest też w linku w Topbarze na każdej zalogowanej stronie, więc przejdzie nawet wtedy, gdy strona pokaże swój komunikat błędu zamiast listy. Krok „dashboard hides the dismissed reminder" sprawdza tylko brak „Nie przypominaj", więc przejdzie też wtedy, gdy ekran miesiąca w ogóle się nie wyrenderuje.
- **Fix**: w kroku ustawień sprawdzać tekst renderowany tylko przez `RecurringManager` (np. „Twoje cykliczne wydatki"), a w kroku ukrytego banera dodatkowo wymagać „Zostaje".
- **Decision**: FIXED (smoke: strona ustawień sprawdza „Twoje cykliczne wydatki”, krok ukrytego banera wymaga też „Zostaje”)

### F3 — Akcje wiersza widoczne podczas edycji kwoty

- **Severity**: OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Pattern Consistency
- **Location**: src/components/settings/RecurringManager.tsx:303-315
- **Detail**: `CategoryManager` chowa akcje wiersza w trakcie edycji (`editing?.id !== category.id`). `RecurringManager` zostawia „Przedłuż" i „Zatrzymaj" widoczne; po zatrzymaniu wiersza w trakcie edycji stan `editing` wskazuje na nieistniejącą definicję.
- **Fix**: ukryć blok akcji, gdy `editing?.id === item.id` (jak w kategoriach).
- **Decision**: FIXED (akcje wiersza ukryte w trakcie edycji kwoty, jak w CategoryManager)

### F4 — Po zatrzymaniu w innej karcie lista nie odświeża się sama

- **Severity**: OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Safety & Quality
- **Location**: src/hooks/useRecurringActions.ts:70-73
- **Detail**: Gałąź 409 (przeładowanie strony) skopiowana z hooka kategorii nie zadziała, bo API cyklicznych nigdy nie zwraca 409. Gdy definicję zatrzymano w innej karcie, akcja zwraca 404 „Nie znaleziono cyklicznego wydatku", a martwy wiersz zostaje do ręcznego odświeżenia.
- **Fix**: w tym hooku traktować 404 jak nieaktualną listę (przeładowanie zamiast 409).
- **Decision**: FIXED (useRecurringActions: 404 przeładowuje stronę zamiast martwej gałęzi 409)

### F5 — Ekran miesiąca robi trzy zapytania po kolei i duplikuje zapytanie o kategorie

- **Severity**: OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Pattern Consistency
- **Location**: src/pages/dashboard.astro:18-38; src/pages/settings/recurring.astro:15-17
- **Detail**: `dashboard.astro` czeka kolejno na kategorie, `month_summary` i `list_recurring_expenses`, a listę cyklicznych pobiera nawet wtedy, gdy sumy się nie wczytały (baner i tak się nie pokaże). Nowy helper `listActiveCategories` nie jest użyty w `dashboard.astro`, które ma identyczne zapytanie i schemat zod.
- **Fix**: `Promise.all` dla niezależnych odczytów, pominąć listę cyklicznych przy błędzie sum, użyć `listActiveCategories` w `dashboard.astro`.
- **Decision**: FIXED (dashboard: Promise.allSettled dla odczytów i listActiveCategories; lista cyklicznych pobierana równolegle, ale używana tylko gdy dane miesiąca się wczytały; recurring.astro: Promise.all)

### F6 — Powtarzające się przyciski bez nazwy pozycji dla czytników ekranu

- **Severity**: OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Pattern Consistency
- **Location**: src/components/month/RecurringReminders.tsx:37-53; src/components/settings/RecurringManager.tsx:304-314
- **Detail**: „Przedłuż…", „Nie przypominaj" i „Zatrzymaj" powtarzają się w każdym wierszu bez nazwy kategorii w etykiecie dostępności, więc na liście przycisków czytnika są nierozróżnialne. Wyjaśnienie „Horyzont obejmuje już 24 miesiące" jest tylko w `title` wyłączonego przycisku, którego nie da się zaznaczyć klawiaturą. Ekran kategorii ma tę samą lukę.
- **Fix**: `aria-label` z nazwą kategorii i kwotą; podpowiedź o maksymalnym horyzoncie jako zwykły tekst zamiast `title`.
- **Decision**: FIXED (aria-label z kategorią i kwotą dla Przedłuż / Nie przypominaj / Zatrzymaj; powód maksymalnego horyzontu jako widoczny tekst zamiast title)

### F7 — Angielskie komunikaty zod przy bezpośrednich wywołaniach API

- **Severity**: OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Pattern Consistency
- **Location**: src/pages/api/recurring-expenses/[id].ts:22
- **Detail**: `{"dismissReminder": false}` zwraca domyślny angielski komunikat zod; ciało `null` lub `[]` daje angielskie „expected object" na obu trasach. UI tego nie wywoła, trasy kategorii zachowują się tak samo.
- **Fix**: `z.literal(true, INVALID_REQUEST)` i polski komunikat na `z.object`.
- **Decision**: FIXED (z.literal(true, INVALID_REQUEST) i polski komunikat na z.object w obu trasach; sprawdzone dla null, [] i dismissReminder: false)

### F8 — Niezacommitowana roadmapa łączy status S-04 z nowymi wpisami Parked

- **Severity**: OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Scope Discipline
- **Location**: context/foundation/roadmap.md (zmiany w worktree)
- **Detail**: Ten sam niezacommitowany diff zawiera zmiany S-04 (status, wiersz handoff) i pięć nowych wpisów Parked dopisanych na prośbę użytkownika. To dwie różne rzeczy; wpis handoff „awaiting PR" zestarzeje się po merge.
- **Fix**: zacommitować `roadmap.md` jako osobny commit dokumentacyjny (np. `docs(roadmap): …`), niezależnie od commitów fazy.
- **Decision**: FIXED (roadmap.md jako osobny commit docs(roadmap) w kroku commita poprawek)

## Rozważone i niezgłoszone

- Rozszerzenia poza planem (`formatMinorForInput`, `listActiveCategories`, dodatkowe kroki smoke: baner, ukrycie, 400) są nieszkodliwe i zostały zgłoszone jako ADAPT w trakcie implementacji.
- Dymki natywnej walidacji w formularzu dodawania: już zaplanowane jako osobna poprawka po fazie 4.
- Edycja migracji po fazie 1: dopuszczalna, bo `db push` (4.7) jeszcze się nie odbył; lokalne bazy wymagają `db reset`.

## Triage

- Data: 2026-10-11. Naprawione: F1 (Fix A), F2, F3, F4, F5, F6, F7, F8 (8). Pominięte, zaakceptowane, odrzucone: 0.
- Po poprawkach: lint, `astro check` (0 błędów), `supabase db reset` + `supabase test db` (163 asercje, `recurring_expenses.test.sql` ma plan(89)) i smoke na serwerze deweloperskim — zielone.
- ADAPT przy F5: lista cyklicznych jest pobierana równolegle z danymi miesiąca (zamiast pomijania jej przy błędzie sum); przy błędzie sum wynik jest po prostu odrzucany.
