<!-- PLAN-REVIEW-REPORT -->
# Plan Review: Historia wpisów z edycją i usuwaniem (S-06)

- **Plan**: context/changes/expense-history-and-edits/plan.md
- **Mode**: Deep
- **Date**: 2026-10-12
- **Verdict**: REVISE → SOUND po poprawkach (wszystkie ustalenia naprawione w planie)
- **Findings**: 0 critical, 4 warnings, 3 observations

## Verdicts

| Dimension | Verdict |
|-----------|---------|
| End-State Alignment | PASS |
| Lean Execution | PASS |
| Architectural Fitness | PASS |
| Blind Spots | WARNING |
| Plan Completeness | WARNING |

## Grounding
11/11 paths ✓, 3/4 symbols ✓ (brak GET /api/recurring-*), brief↔plan ✓

## Findings

### F1 — pgTAP: kaskada błędów po zmianie polityk
- **Severity**: WARNING / **Impact**: LOW / **Dimension**: Plan Completeness / **Location**: Faza 1
- **Detail**: `expenses_income.test.sql:101-104` robi UPDATE/DELETE bez WHERE; po nowych politykach padają też `:106`, `:108-117`; dodatkowo `recurring_expenses.test.sql:178-181`, `recurring_incomes.test.sql:177-180`.
- **Fix**: wypisać asercje, celować w jeden wiersz po id, zaktualizować `plan(n)`.
- **Decision**: FIXED (Fix in plan)

### F2 — Smoke czyta listę cykli przez nieistniejący GET
- **Severity**: WARNING / **Impact**: LOW / **Dimension**: Plan Completeness / **Location**: Faza 5
- **Fix**: czytać listę z odpowiedzi `PATCH {dismissReminder:true}`.
- **Decision**: FIXED (Fix in plan)

### F3 — Typy w fazie 2, mappery w fazie 5
- **Severity**: WARNING / **Impact**: LOW / **Dimension**: Plan Completeness / **Location**: Faza 2 vs 5
- **Fix**: przenieść `editedFutureCount` do fazy 5 razem z mapperami i strażnikami typów.
- **Decision**: FIXED (Fix in plan)

### F4 — Trigger: jawna lista zablokowanych kolumn
- **Severity**: WARNING / **Impact**: LOW / **Dimension**: Blind Spots / **Location**: Faza 1
- **Fix**: jawna lista kolumn, `IS DISTINCT FROM`, `edited_at` poza porównaniem.
- **Decision**: FIXED (Fix in plan)

### F5 — HistoryList: propsy i znikający wpis
- **Severity**: OBSERVATION / **Impact**: LOW / **Dimension**: Blind Spots / **Location**: Faza 3/4
- **Fix**: propsy `params` i kategorie; komunikat „Przeniesiono do {miesiąc}”.
- **Decision**: FIXED (Fix in plan)

### F6 — Pułapki wykonawcze (kolizja tras, auth w GET, kolejność smoke)
- **Severity**: OBSERVATION / **Impact**: LOW / **Dimension**: Plan Completeness / **Location**: Faza 2 i 5
- **Fix**: trzy punkty dopisane do kontraktów.
- **Decision**: FIXED (Fix in plan)

### F7 — Opcjonalny indeks po kategorii
- **Severity**: OBSERVATION / **Impact**: LOW / **Dimension**: Lean Execution / **Location**: Faza 1
- **Fix**: usunąć z planu, dopisać do „What We're NOT Doing”.
- **Decision**: FIXED (usunięto na prośbę użytkownika)

## Aktualizacja po triage (2026-10-12)

Po przeglądzie użytkownik przyciął zakres: zrezygnował ze znacznika `edited_at` z licznikiem i ostrzeżeniem (zamiast tego stała podpowiedź w edycji kwoty cyklu) oraz ze strzałek, `?month=` i trybu tylko do odczytu na ekranie miesiąca (zostaje link w tytule do historii). Skutki dla ustaleń: F2 (smoke czytający `editedFutureCount`) i F3 (przeniesienie pól typu do fazy 5) przestały dotyczyć planu; pozostałe poprawki obowiązują. Plan i brief zaktualizowane; w `## Progress` jest 28 wierszy.
