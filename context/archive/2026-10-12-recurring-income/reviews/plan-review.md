<!-- PLAN-REVIEW-REPORT -->
# Plan Review: Cykliczne przychody (S-05)

- **Plan**: context/changes/recurring-income/plan.md
- **Mode**: Deep
- **Date**: 2026-10-12
- **Verdict**: SOUND
- **Findings**: 0 critical  1 warning  1 observation

## Verdicts

| Dimension | Verdict |
|-----------|---------|
| End-State Alignment | PASS |
| Lean Execution | PASS |
| Architectural Fitness | PASS |
| Blind Spots | WARNING |
| Plan Completeness | WARNING |

## Grounding

Grounding: 6/6 paths ✓, 6/6 symbols ✓, brief↔plan ✓

Checked existing paths the plan modifies: `src/types.ts`, `src/pages/settings/recurring.astro`, `src/components/Topbar.astro`, `src/components/month/MonthScreen.tsx`, `src/pages/dashboard.astro`, `scripts/smoke.mjs`. New files (migration, service, routes, hook, income UI) are create-only.

Symbols confirmed: `INCOME_SOURCES` matches the `incomes.source` CHECK; `amountField`, `dayOfMonthField`, `monthsField`; `PROTECTED_ROUTES` includes `/settings`; `warsaw_today` / `recurring_slot_date` / `recurring_month_diff` granted to `authenticated`; `incomes` has only SELECT/INSERT; `dashboard.astro` loads reminders via `Promise.allSettled`.

Claims checked and not raised as findings: amount change and stop DELETE future rows and INSERT replacements (no UPDATE on `incomes`); `remind` is `months_left between 0 and 1`; smoke step "dashboard hides the dismissed reminder" fails if a second banner still contains "Nie przypominaj" — the plan's order (income steps after the expense stop, banner identified by `aria-label`) covers it. `MonthScreen`'s only caller is `dashboard.astro`.

## Findings

### F1 — Strażnik listy w hooku odrzuci poprawny przychód

- **Severity**: ⚠️ WARNING
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Blind Spots
- **Location**: Phase 3 — Hook i komponent
- **Detail**: `useRecurringActions.ts:23-37` sprawdza `categoryId`, `categoryName` i `categoryArchived` na wartości `unknown`. Predykat typu nie jest sprawdzany przez kompilator, więc skopiowanie funkcji do hooka przychodów przejdzie `astro check`. Każda odpowiedź 200 z polami `source` zostanie odrzucona (`isRecurringList`, linie 39-40): zapis w bazie się uda, a UI pokaże „Nie udało się zapisać” i nie podmieni listy. Ponowne „Dodaj” dostanie 23505. Smoke tego nie widzi — woła API i czyta HTML z serwera, nie ten strażnik. Etykiety z `categoryName` w `RecurringReminders.tsx:29` kompilator złapie; ten strażnik nie.
- **Fix**: W kontrakcie fazy 3 dopisz, że parser odpowiedzi sprawdza `source` (i resztę `RecurringIncome`), a nie pola kategorii.
- **Decision**: FIXED (Fix in plan)

### F2 — Tytuł i błąd ładowania zostają przy wydatkach

- **Severity**: ℹ️ OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Plan Completeness
- **Location**: Phase 3 — Strona i przełącznik
- **Detail**: `recurring.astro:24` ma tytuł „Hajsownik — cykliczne wydatki”, a linia 39 komunikat „Nie udało się wczytać cyklicznych wydatków”. Kontrakt rozgałęzia listę i komponent, nie te napisy. Przy `?typ=przychody` i błędzie odczytu użytkownik dostaje tekst o wydatkach. Smoke sprawdza nagłówek menedżera, więc zostaje zielony.
- **Fix**: W kontrakcie strony: `title` i akapit błędu zależą od `typ`; bez parametru zostają dotychczasowe napisy o wydatkach.
- **Decision**: FIXED (Fix in plan)
