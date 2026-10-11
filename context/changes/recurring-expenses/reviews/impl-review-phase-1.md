<!-- IMPL-REVIEW-REPORT -->
# Implementation Review: Cykliczne wydatki (S-04)

- **Plan**: context/changes/recurring-expenses/plan.md
- **Scope**: Phase 1 of 4
- **Reviewed phases**: 1
- **Date**: 2026-10-11
- **Verdict**: APPROVED
- **Findings**: 0 critical 2 warnings 3 observations

## Verdicts

| Dimension | Verdict |
|-----------|---------|
| Plan Adherence | PASS |
| Scope Discipline | PASS |
| Safety & Quality | WARNING |
| Architecture | PASS |
| Pattern Consistency | PASS |
| Success Criteria | WARNING |

## Findings

### F1 — Test pgTAP nie obejmuje części przypadków wymaganych w planie i kluczowych ochron

- **Severity**: ⚠️ WARNING
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Success Criteria
- **Location**: supabase/tests/database/recurring_expenses.test.sql (brak asercji; najbliższe: linie 181-182, 270)
- **Detail**: Kontrakt Phase 1 wymaga, żeby `list` liczył `months_left`/`remind` dla definicji kończącej się w bieżącym i następnym miesiącu oraz zwracał `remind = false` dla kończącej się za 2 miesiące. Test sprawdza tylko następny miesiąc (`months_left` 1, `remind` true) oraz `months_left` 2 po przedłużeniu wygasłej definicji, ale bez `remind`. Brakuje granicy `months_left = 0` z `remind = true` (D3 ma 0, ale nigdy nie jest wylistowana przed przedłużeniem). Poza planem brakuje też ochron, dla których powstały złożone FK i polityka DELETE: wstawienie wpisu z `recurring_expense_id` cudzego gospodarstwa (23503), usunięcie kategorii mającej definicję (23503), pozytywny bezpośredni DELETE wpisów generowanych przez właściciela, faktyczne daty wierszy D1 (przycięcie dnia 31 w wygenerowanych wierszach, nie tylko w czystym helperze) oraz kaskada usunięcia gospodarstwa (sprawdzona ręcznie w tej sesji: 3 wpisy i 1 definicja znikają bez błędu).
- **Fix**: Dopisać asercje: `remind = false` przy `months_left` 2, `months_left` 0 z `remind = true`, oba przypadki FK/kategorii (23503), bezpośredni DELETE wpisów generowanych przez właściciela, daty wierszy D1 równe `recurring_slot_date` dla każdego miesiąca, kaskada usunięcia gospodarstwa (jako właściciel, `reset role`). Podnieść `plan(N)`.
- **Decision**: FIXED (dopisano 11 asercji: remind/months_left dla 0 i 2 miesięcy, daty wierszy D1, cudzy recurring_expense_id 23503, kategoria z definicją 23503, bezpośredni DELETE wpisu generowanego, kaskada gospodarstwa; plan(85))

### F2 — `create_recurring_expense` nie jest odporne na podwójne wywołanie

- **Severity**: ⚠️ WARNING
- **Impact**: 🔎 MEDIUM — real tradeoff; pause to reason through it
- **Dimension**: Safety & Quality
- **Location**: supabase/migrations/20261011130000_recurring_expenses.sql:104-130
- **Detail**: Operacje na istniejącej definicji blokują jej wiersz, więc podwójny klik na „Przedłuż" czy „Zatrzymaj" jest bezpieczny. Tworzenie nie ma na czym się zablokować: dwa wywołania RPC (podwójny submit, dwie karty) tworzą dwie identyczne definicje i podwójną liczbę wpisów, co podwaja sumy miesiąca, a zatrzymanie jednej zostawia drugą aktywną. Limit liczby definicji został świadomie pominięty w planie, ale to jest inny przypadek: przypadkowy duplikat.
- **Fix A ⭐ Recommended**: Zablokować przycisk „Dodaj" na czas żądania (stan `pending` z hooka, jak w `CategoryManager`) i wpisać to jako wymaganie do kontraktu Phase 3 komponentu `RecurringManager`.
  - Strength: Zero zmian w bazie; usuwa przyczynę (podwójny klik); zgodne z wzorcem `useCategoryActions`.
  - Tradeoff: Nie chroni przed dwiema kartami lub ręcznym wywołaniem API.
  - Confidence: HIGH — hook ma `pending`, a komponenty kategorii już go używają.
  - Blind spot: Nie sprawdzałem, czy `CategoryManager` blokuje przycisk dodawania na czas żądania.
- **Fix B**: Częściowy indeks unikalny `(household_id, category_id, amount_minor, day_of_month, start_month) where stopped_at is null`.
  - Strength: Twarda gwarancja w bazie, także dla dwóch kart.
  - Tradeoff: Blokuje też świadome, identyczne definicje (dwie takie same subskrypcje w jednym miesiącu), a komunikat błędu 23505 wymaga mapowania w API.
  - Confidence: MEDIUM — zależy od tego, czy takie definicje mają być dozwolone.
  - Blind spot: Czy użytkownik zechce dwie identyczne definicje.
- **Decision**: FIXED via Fix A + B + ACCEPTED-AS-RULE: Operacja tworząca potrzebuje ochrony przed duplikatem w UI i w bazie (indeks unikalny w migracji + 2 asercje, plan(87); blokada przycisku i mapowanie 23505 dopisane do kontraktów Phase 3 i 2)

### F3 — `FOR UPDATE` jest mocniejszy niż potrzeba

- **Severity**: OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Safety & Quality
- **Location**: supabase/migrations/20261011130000_recurring_expenses.sql:144,181,211
- **Detail**: Funkcje zmieniają tylko kolumny niebędące kluczem. `FOR UPDATE` koliduje z blokadą `FOR KEY SHARE` z kontroli FK, więc równoległe wstawienie wpisu z `recurring_expense_id` (inna karta) czeka do końca funkcji. Deadlock nie jest możliwy (kolejność blokad stała), więc to tylko niepotrzebne czekanie.
- **Fix**: Zamienić `for update` na `for no key update` w `update_recurring_expense_amount`, `extend_recurring_expense` i `stop_recurring_expense`.
- **Decision**: FIXED (for update -> for no key update w update_recurring_expense_amount, extend_recurring_expense, stop_recurring_expense)

### F4 — Pomocnik `recurring_month_diff` nie występuje w planie

- **Severity**: OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Scope Discipline
- **Location**: supabase/migrations/20261011130000_recurring_expenses.sql:87-96
- **Detail**: Plan wymienia dwa czyste pomocniki (`warsaw_today`, `recurring_slot_date`). Dodano trzeci, `recurring_month_diff`, używany w update, extend i list, z tymi samymi uprawnieniami i testami. Jest nieszkodliwy, ale plan i migracja się rozjeżdżają, a funkcja jest wywoływalna przez RPC.
- **Fix**: Dopisać jedną linię do kontraktu Phase 1 w planie (pomocnik, powód: jedno miejsce na arytmetykę miesięcy).
- **Decision**: FIXED (recurring_month_diff dopisany do Implementation Approach, Critical Implementation Details i kontraktu Phase 1)

### F5 — `update_recurring_expense_amount` przelicza sloty od `start_month`

- **Severity**: OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Safety & Quality
- **Location**: supabase/migrations/20261011130000_recurring_expenses.sql:155-156
- **Detail**: `generate_series(0, recurring_month_diff(start_month, end_month))` obejmuje całe życie definicji, a przeszłe sloty są odrzucane dopiero filtrem `spent_on > today`. Wstawiane wiersze pozostają ograniczone (najwyżej 25), ale liczba kandydatów rośnie z wiekiem definicji. Definicja zapisana bezpośrednio przez PostgREST z `end_month` w odległej przyszłości wymusza tu bardzo długą pętlę; to samo-zaszkodzenie w ramach własnego gospodarstwa, objęte zaakceptowanym ryzykiem bezpośredniego zapisu.
- **Fix**: Zaczynać serię od `greatest(0, recurring_month_diff(start_month, bieżący miesiąc))` zamiast od zera.
- **Decision**: FIXED (seria regeneracji startuje od greatest(0, diff(start_month, bieżący miesiąc)))

## Rozważone i odrzucone (nie są ustaleniami)

- Wpis z dniem już minionym w miesiącu utworzenia (agent: „backdated"): zgodne z decyzją z wywiadu i regułą FR-014.
- `update_recurring_expense_amount` przywraca ręcznie usunięty przyszły wpis: zgodne z FR-015 (usuń i zregeneruj) i opisane w Open Risks briefu.
- Zdanie „insert-only until S-06" w starej migracji (`20261008233243…:3`) jest teraz częściowo nieaktualne: zastosowanej migracji się nie edytuje, a nowa ma własny nagłówek.
- Brak unikalności wpisu na miesiąc w bazie: duplikaty powstają tylko przez bezpośredni INSERT z własnym `recurring_expense_id` w obrębie własnego gospodarstwa.
- Parametr `p_today` dla testowalności: odrzucony w planie, bo pozwalałby cofać datę przez RPC.

## Triage

- Data: 2026-10-11. Naprawione: F1, F2 (Fix A + B + reguła w lessons.md), F3, F4, F5 (5). Pominięte, zaakceptowane, odrzucone: 0.
- Po poprawkach: `npx supabase db reset` oraz `npx supabase test db` zielone (4 pliki, 161 asercji; recurring_expenses.test.sql ma plan(87)).
