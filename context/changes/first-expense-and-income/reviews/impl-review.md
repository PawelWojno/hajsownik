<!-- IMPL-REVIEW-REPORT -->
# Implementation Review: First expense + income, month "zostaje"

- **Plan**: context/changes/first-expense-and-income/plan.md
- **Scope**: Full plan
- **Reviewed phases**: 1, 2, 3, 4
- **Date**: 2026-10-09
- **Verdict**: NEEDS ATTENTION
- **Findings**: 0 critical  2 warnings  2 observations

## Verdicts

| Dimension | Verdict |
|-----------|---------|
| Plan Adherence | WARNING |
| Scope Discipline | WARNING |
| Safety & Quality | WARNING |
| Architecture | PASS |
| Pattern Consistency | PASS |
| Success Criteria | PASS |

## Automated checks (re-run 2026-10-09)

- `npx supabase db reset` — exit 0; migration `20261008233243_first_expense_and_income.sql` applied
- `npx supabase test db` — PASS, 45 tests (expenses_income + household_isolation)
- `npm run lint` — exit 0
- `npx astro check` — 0 errors, 0 warnings
- `npm run build` — exit 0
- `npm run smoke` against the production preview — all steps passed, including sign-in → `/dashboard`, expense and income `left`, amount 0 → 400, no cookie → 401

Manual Progress rows are all `[x]` with commit SHAs. The behaviors they name are present in the diff (pgTAP for isolation and the 12 categories, smoke for the API, Polish chrome, `data-category-ids`).

## Findings

### F1 — Ponowienie zapisu po błędzie sum wstawia drugi wiersz

- **Severity**: ⚠️ WARNING
- **Impact**: 🔎 MEDIUM — real tradeoff; pause to reason through it
- **Dimension**: Safety & Quality
- **Location**: src/pages/api/expenses.ts:51
- **Detail**: Insert do `expenses` / `incomes` jest już zatwierdzony, zanim handler czyta `month_summary`. Gdy odczyt sum się nie uda, oba endpointy zwracają 500 z tekstem `Nie udało się zapisać. Spróbuj ponownie.` (`src/pages/api/expenses.ts:51-55`, `src/pages/api/incomes.ts:40-44`). Klient traktuje każdy nie-ok jako brak zapisu (`src/hooks/useEntrySubmit.ts:46-47`, `src/components/month/EntrySheet.tsx:137-139`): zostawia wypełniony formularz i nie rusza sum. Drugie tapnięcie Zapisz wstawia drugi wiersz.
- **Fix A ⭐ Recommended**: Po udanym insercie, gdy sumy się nie odczytają, zwróć 200 oznaczające „zapisane, sumy nieświeże”; klient czyści formularz i zostawia dotychczasowe kwoty
  - Strength: Komentarz w obu endpointach już przyznaje, że wiersz jest zapisany. Retry przestaje dublować wpis. Zmiana jest wąska.
  - Tradeoff: Na tej rzadkiej ścieżce ekran nie spełnia „sumy z odpowiedzi w mniej niż 1 s”, dopóki użytkownik nie wejdzie na ekran ponownie.
  - Confidence: HIGH — rozgałęzienie jest w kodzie; smoke przechodzi tylko szczęśliwą ścieżkę, na której sumy się udają.
  - Blind spot: Nie odtworzyłem awarii RPC na żywo.
- **Fix B**: Jedna funkcja SQL wstawia wiersz i zwraca `month_summary` w jednej transakcji, więc 500 znaczy „nic nie zapisano”
  - Strength: Tekst „Spróbuj ponownie” zostaje prawdziwy, a planowany kontrakt „POST zwraca świeże sumy” zostaje przy sukcesie.
  - Tradeoff: Nowe RPC, osobny GRANT EXECUTE, insert schodzi ze ścieżki `.from().insert()`, którą dziś pokrywa pgTAP przez RLS.
  - Confidence: MEDIUM — polityki INVOKER powinny przepuścić insert wołany jako `authenticated`, ale tego wariantu test jeszcze nie ma.
  - Blind spot: Kolejność DEFAULT `household_id` wewnątrz funkcji wobec WITH CHECK nie jest sprawdzona.
- **Decision**: FIX A — wdrożone: `summary: null` + komunikat "Zapisano, ale nie udało się odświeżyć sum. Odśwież stronę."; zweryfikowane awarią RPC na lokalnej bazie (200, 1 wiersz)

### F2 — Zamknij i opis są poniżej 44 px

- **Severity**: ⚠️ WARNING
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Plan Adherence
- **Location**: src/components/month/EntrySheet.tsx:68
- **Detail**: Kontrakt fazy 3 wymaga celu dotykowego minimum 44 px. Przycisk Zamknij używa `size="icon"`, a w `src/components/ui/button.tsx:25` to `size-9` (36 px). Pole opisu (`EntrySheet.tsx:257`) bierze sam `fieldClass` (`py-2`, bez `min-h-11`). Kwota, data, źródło, kategorie i Zapisz mają `min-h-11` albo większy tekst.
- **Fix**: Na Zamknij daj `min-h-11 min-w-11`, a na input opisu `min-h-11`.
- **Decision**: FIX — wdrożone: `min-h-11 min-w-11` na Zamknij, `min-h-11` na polu opisu

### F3 — month_summary normalizuje datę do kalendarzowego miesiąca

- **Severity**: ℹ️ OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Plan Adherence
- **Location**: supabase/migrations/20261008233243_first_expense_and_income.sql:125
- **Detail**: Plan mówi o oknie `[p_month, p_month + 1 miesiąc)`. Funkcja najpierw bierze `date_trunc('month', p_month)`, więc `month_summary('2026-10-15')` liczy cały październik. API zawsze podaje pierwszy dzień miesiąca (`currentMonthStart()`), więc ekran jest zgodny z planem. pgTAP utrwala zachowanie kalendarzowe (`expenses_income.test.sql` woła `month_summary('2026-10-15')`).
- **Fix**: W kontrakcie fazy 1 zapisz, że `p_month` jest obcinane do pierwszego dnia miesiąca — tak jak robi to test.
- **Decision**: FIX — plan.md: kontrakt fazy 1 opisuje obcinanie `p_month` do pierwszego dnia miesiąca

### F4 — Dodatkowy FK household_id z ON DELETE CASCADE

- **Severity**: ℹ️ OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Scope Discipline
- **Location**: supabase/migrations/20261008233243_first_expense_and_income.sql:18
- **Detail**: Kontrakt dawał `on delete cascade` do `households` tylko kategoriom. `expenses.household_id` (linia 18) i `incomes.household_id` (linia 33) też mają ten FK. Usunięcie gospodarstwa skasuje też wpisy. Izolacja RLS się nie zmienia. Poza planem nie ma listy wpisów, edycji, paska budżetu ani tłumaczenia auth.
- **Fix**: Dopisz te dwa klucze obce do kontraktu fazy 1. Kodu nie cofaj.
- **Decision**: FIX — plan.md: kontrakt fazy 1 dopisuje FK z `on delete cascade` dla `expenses` i `incomes`
