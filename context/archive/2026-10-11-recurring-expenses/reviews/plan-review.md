<!-- PLAN-REVIEW-REPORT -->
# Plan Review: Cykliczne wydatki (S-04)

- **Plan**: context/changes/recurring-expenses/plan.md
- **Mode**: Deep
- **Date**: 2026-10-11
- **Verdict**: REVISE
- **Findings**: 0 critical 3 warnings 3 observations

## Verdicts

| Dimension | Verdict |
|-----------|---------|
| End-State Alignment | PASS |
| Lean Execution | PASS |
| Architectural Fitness | WARNING |
| Blind Spots | WARNING |
| Plan Completeness | WARNING |

## Grounding

Grounding: 8/8 paths ✓, 8/8 symbols ✓, brief↔plan ✗, Progress↔Phase ✓

S-05 (`recurring-income`) nie ma jeszcze planu. Ten plan go nie blokuje: bliźniacza tabela i kolumna na `incomes` pasują do FR-016/FR-017, a `warsaw_today()` i `recurring_slot_date` da się współdzielić. Sygnatur funkcji nie da się skopiować — przychód ma `source` i `received_on`, nie `category_id` i `spent_on`, a zły `source` to `23514`, nie FK `23503`.

Wąska polityka DELETE (`recurring_expense_id is not null`) nie psuje istniejącego pgTAP: fixture ma same wpisy ręczne. `month_summary` dolicza późniejszy dzień bieżącego miesiąca i nie dolicza kolejnych miesięcy.

## Findings

### F1 — Krok smoke nie da się wstawić tam, gdzie plan go każe

- **Severity**: ⚠️ WARNING
- **Impact**: 🔎 MEDIUM — real tradeoff; pause to reason through it
- **Dimension**: Blind Spots
- **Location**: Phase 4 — Smoke
- **Detail**: Kontrakt każe jeden krok (create, PATCH, strona zalogowana, DELETE, przekierowanie anonima i POST 401) po asercjach `left` (`scripts/smoke.mjs:181-187`), a przed anonimowym 401 wydatków. Strona zalogowana musi być przed wylogowaniem (`:244`), a GET anonima dopiero obok przekierowania ustawień (`:246-249`). POST 401 w `expenses.ts:21` wraca, zanim serwer przeczyta body; komentarz przy `smoke.mjs:266-267` mówi, że takie żądanie psuje następne na tym samym połączeniu, dlatego 401 wydatków jest ostatnie. Drugi taki POST tuż przed nim wywali smoke. Kategoria „Smoke Zwierzęta” (`:199`) jest potem kasowana jako nieużywana (`:234-237`); wpis cykliczny na tym id zablokuje DELETE przez FK bez ON DELETE.
- **Fix A ⭐ Recommended**: Rozpisać trzy miejsca i czytać body przed 401. Signed-in create/PATCH/GET/DELETE zaraz po asercji `left`, na `categoryId` z dashboardu, przed dodaniem „Smoke Zwierzęta”. GET anonima po wylogowaniu. POST 401 cykliczny tuż przed 401 wydatków, ale endpoint najpierw czyta body.
  - Strength: Zostaje automatyczne 401 API i reguła „401 wydatków ostatnie”.
  - Tradeoff: Ten endpoint odbiega od `expenses.ts`, który zwraca 401 wcześniej.
  - Confidence: HIGH — kolejność i komentarz są w `smoke.mjs`, 401 w `expenses.ts:21`.
  - Blind spot: Nie odpalałem smoke; opieram się na komentarzu w skrypcie.
- **Fix B**: Zostawić anonimowość tylko jako GET 302, bez POST 401 w smoke. Te same miejsca dla kroków zalogowanych i dla GET po wylogowaniu.
  - Strength: Wzorzec 401 bez zmian; GET nie ma body.
  - Tradeoff: 401 API zostaje tylko w ręcznym kroku 2.5, nie w CI.
  - Confidence: HIGH — GET po signout już tak działa dla kategorii.
  - Blind spot: None significant.
- **Decision**: FIXED (Fix C: jak Fix A, ale anonimowy test 401 to DELETE bez body zamiast POST; Phase 4 — Smoke)

### F2 — Baner podmienia stan pełną listą i zostawia wyciszone definicje

- **Severity**: ⚠️ WARNING
- **Impact**: 🔎 MEDIUM — real tradeoff; pause to reason through it
- **Dimension**: Architectural Fitness
- **Location**: Phase 4 — Baner, wobec hooka z Phase 3
- **Detail**: `dashboard.astro` przekazuje tylko wiersze z `remind = true`. Hook ma kopiować `useCategoryActions`, który po mutacji podmienia cały stan odpowiedzią (`useCategoryActions.ts:60-65`). Mutacja zwraca pełną listę niezatrzymanych definicji, nie sam baner. Po „Nie przypominaj” wiersz ma `remind = false`, ale zostaje w stanie — baner pokaże też definicje, które nie przypominają. Zdanie „usuń pozycję z lokalnego stanu” i „podmień listę z serwera” nie mogą być prawdziwe naraz.
- **Fix A ⭐ Recommended**: Przekazać pełną listę i filtrować `remind` po każdej odpowiedzi.
  - Strength: Zgadza się z kontraktem „mutacja zwraca świeżą listę” i z hookiem kategorii.
  - Tradeoff: Ekran miesiąca dostaje też definicje bez banera.
  - Confidence: HIGH — oba zachowania są w planie i w `useCategoryActions.ts`.
  - Blind spot: None significant.
- **Fix B**: Baner trzyma własną tablicę i sam wycina wiersz, bez podmiany z pełnej listy.
  - Strength: Do przeglądu idą tylko przypomnienia.
  - Tradeoff: Drugi sposób aktualizacji obok hooka, który plan każe skopiować.
  - Confidence: HIGH — da się napisać, ale to już inny wzorzec niż kategorie.
  - Blind spot: None significant.
- **Decision**: FIXED (Fix A: pełna lista w propsie, baner filtruje `remind` po każdej odpowiedzi hooka)

### F3 — Tekst banera używa nazwy, której schemat nie ma

- **Severity**: ⚠️ WARNING
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Blind Spots
- **Location**: Phase 4 — Baner
- **Detail**: Przykład „Czynsz (Dom i rachunki)” zakłada etykietę definicji. FR-014 ma kwotę, kategorię, częstotliwość i horyzont; kolumny w planie też nie mają nazwy. Dwa czynsze w „Dom i rachunki” dostaną ten sam tekst. Lista wiersza odróżnia je kwotą, dniem i zakresem — baner już nie.
- **Fix**: Tekst banera: nazwa kategorii, `formatMinor`, dzień miesiąca. Przykład: „Dom i rachunki, 1 850,00 zł, dzień 10: kończy się za 1 mies.”
- **Decision**: FIXED (tekst banera: kategoria, kwota, dzień miesiąca)

### F4 — Limit horyzontu 1–24 czeka na potwierdzenie

- **Severity**: OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Blind Spots
- **Location**: Implementation Approach, Open Risks w briefie
- **Detail**: Plan już wybiera limit 1–24 na jedną operację, bez sufitu sumy, i prosi o potwierdzenie przy tym przeglądzie. Bez zdania „do potwierdzenia” implementator i tak ma jednoznaczny kontrakt. Druga interpretacja z wywiadu (łącznie najwyżej 24) jest nadal otwarta tylko na papierze.
- **Fix**: Zostawić limit na operację i skreślić „do potwierdzenia” w planie i w briefie. Sufit łączny 24 odrzucić w tym zdaniu.
- **Decision**: FIXED (inaczej niż w raporcie: zamiast skreślić „do potwierdzenia" użytkownik wybrał wariant C — po operacji najwyżej 24 miesiące do przodu, przedłużanie bez końca; zmiany w Implementation Approach, Phase 1–3, Performance, briefie)

### F5 — Brief mówi, że przedłużenie odtwarza usunięte sloty

- **Severity**: OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Plan Completeness
- **Location**: plan-brief.md, Open Risks
- **Detail**: Brief: ręcznie usunięty przyszły wpis (S-06) wraca przy edycji kwoty albo przy przedłużeniu. Plan: edycja kwoty kasuje i wstawia ponownie sloty z datą późniejszą niż dziś; przedłużenie tylko dopisuje sloty od `max(end_month + 1 miesiąc, bieżący miesiąc)`. Dziury wewnątrz horyzontu przedłużenie zostawia.
- **Fix**: W briefie zostawić odtwarzanie tylko przy edycji kwoty. Przedłużenie opisuje jako dopisywanie za końcem horyzontu.
- **Decision**: FIXED (brief: odtwarzanie usuniętych slotów tylko przy edycji kwoty)

### F6 — Lista bez kierunku sortowania

- **Severity**: OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Plan Completeness
- **Location**: Phase 1 — `list_recurring_expenses`
- **Detail**: „Posortowane po `created_at`” nie mówi, czy najnowsze są na górze, ani co przy remisie. Implementator wybierze sam.
- **Fix**: `order by created_at desc, id`.
- **Decision**: FIXED (`order by created_at desc, id`)

## Triage

- Data: 2026-10-11. Naprawione: F1 (Fix C), F2 (Fix A), F3, F4 (wariant C), F5, F6 (6). Pominięte, zaakceptowane i odrzucone: 0.
- Werdykt po poprawkach: SOUND (plan i brief naniesione; Progress bez zmian, bo kryteria sukcesu nie zmieniły się co do liczby ani treści).
