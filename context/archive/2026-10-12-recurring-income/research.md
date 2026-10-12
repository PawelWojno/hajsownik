---
date: 2026-10-12T12:05:26+02:00
researcher: Claude (Sonnet 5.5)
git_commit: 1b9dfe36aec45c97782c5f324c6475174a595af6
branch: master
repository: Hajsownik
topic: "recurring-income: które wzorce z recurring-expenses (S-04) da się powielić, a gdzie przychody się różnią"
tags: [research, codebase, recurring-income, recurring-expenses, supabase, rpc]
status: complete
last_updated: 2026-10-12
last_updated_by: Claude (Sonnet 5.5)
---

# Research: recurring-income powiela wzorce z recurring-expenses

**Date**: 2026-10-12T12:05:26+02:00
**Git Commit**: 1b9dfe36aec45c97782c5f324c6475174a595af6 (master)

## Research Question

S-05 (FR-016, FR-017) ma być "tym samym mechanizmem zastosowanym do drugiej encji" (`roadmap.md:154`). Co dokładnie z S-04 można skopiować, co trzeba zmienić, bo `incomes` ma inny kształt niż `expenses`, i które elementy są dziś zahardkodowane pod wydatki?

## Summary

Skopiować można prawie całą warstwę bazy i API. Różnice dotyczą wyłącznie kształtu tabeli `incomes` (sprawdzona ścieżka: `20261008233243_first_expense_and_income.sql:31-40`):

1. **Brak kategorii.** `incomes` ma `source` (tekst z `CHECK ... in (5 wartości)`), a nie `category_id`. W definicji cyklicznej odpada więc złożony FK do `categories`, a razem z nim `ON DELETE CASCADE`, który w S-04 wprowadziła poprawka po review (F1). Zostaje zwykły `check` na `source`.
2. **Inna nazwa kolumny daty**: `received_on` zamiast `spent_on`.
3. **Brak opisu** w `incomes` (w `expenses` jest `description`, ale generator S-04 go nie wypełnia, więc to bez znaczenia).
4. **Brak polityki DELETE** na `incomes` (jest tylko SELECT i INSERT, `:58-64`). Trzeba dodać wąską politykę `incomes_delete_generated`, jak `expenses_delete_generated` w S-04.

Pomocnicze funkcje `warsaw_today`, `recurring_slot_date`, `recurring_month_diff` nie dotykają tabel i mają `grant ... to authenticated` (`20261011130000_recurring_expenses.sql:73-105,284-289`), więc S-05 może je wywołać bez zmian.

Po stronie aplikacji nie da się skopiować "po nazwie" tego, co jest wiązane z wydatkami na sztywno: hook `useRecurringActions` (adresy URL i typ), `recurringResponse` (komunikat 404), typ `RecurringExpense` (pola kategorii), `RecurringReminders` (tekst baneru) i `MonthScreen`, który dostaje tylko listę wydatków. To główna decyzja projektowa do planu: uogólnić te elementy czy zduplikować.

## Detailed Findings

### Baza: tabela, polityki, funkcje (S-04)

- Tabela `recurring_expenses`: `amount_minor`, `day_of_month`, `start_month`, `end_month` (oba pierwszy dzień miesiąca), `stopped_at` (miękkie usunięcie), `reminder_dismissed_at`; `unique (household_id, id)` jako cel złożonego FK z wpisów (`:13-32`).
- Wpisy wskazują definicję przez `expenses.recurring_expense_id` ze złożonym FK `(household_id, recurring_expense_id)` i częściowym indeksem `(recurring_expense_id, spent_on) where recurring_expense_id is not null` (`:40-47`). Analogicznie S-05 potrzebuje `incomes.recurring_income_id`.
- Polityki: SELECT/INSERT/UPDATE na definicji, każda z `household_id = (select public.current_household_id())` (`:51-62`), zgodnie z lekcją w `lessons.md:7-10`. Brak polityki DELETE na definicji (miękkie usunięcie).
- Częściowy unikalny indeks przeciw podwójnemu submitowi: `(household_id, category_id, amount_minor, day_of_month, start_month) where stopped_at is null` (`:36-38`); to wymóg lekcji `lessons.md:19-24`, która wprost wymienia S-05. W przychodach kolumną rozróżniającą będzie `source` zamiast `category_id`.
- Sześć funkcji `SECURITY INVOKER` z `set search_path = ''`: `create_`, `update_..._amount`, `extend_`, `stop_`, `dismiss_..._reminder`, `list_` (`:113-281`). Wszystkie blokują wiersz definicji `for no key update` i zgłaszają `P0002`, gdy definicji brak, jest cudza albo zatrzymana (`:154-157,195-198,225-228`).
- Reguły: wpisy "przyszłe" to `spent_on > warsaw_today()`; stop i zmiana kwoty kasują tylko je (`:160,230`); horyzont najwyżej 24 miesiące licząc od bieżącego, czyli `months_left <= 23` (`:202`); `p_months` 1..24 (`:124,191`); wygasła definicja przy przedłużeniu startuje od bieżącego miesiąca (`:200`).
- `revoke execute ... from public, anon` + `grant ... to authenticated` dla każdej nowej funkcji (`:283-301`), zgodnie z migracją `20261008200524_revoke_function_execute.sql`.
- `list_recurring_expenses` łączy z `categories` po nazwę i flagę archiwizacji (`:277`). Dla przychodów ten `join` odpada, a zamiast `category_name`/`category_archived` lista zwraca `source`.

### Baza: strona przychodów

- `incomes`: `source`, `amount_minor`, `received_on`, `household_id default current_household_id()`, indeks `(household_id, received_on)` (`20261008233243...sql:31-40`).
- Zapytanie `month_summary` sumuje `incomes` i `expenses` po dacie w miesiącu (`:115-133`), więc wygenerowane przychody trafią do "Zostaje" bez zmian w tej funkcji.
- Wartości `source` są zdefiniowane dwa razy: w `CHECK` (`:34`) i w `INCOME_SOURCES` (`src/types.ts:1`). Formularz definicji powinien brać listę z tej stałej.

### Testy pgTAP

- `supabase/tests/database/recurring_expenses.test.sql` ma `plan(89)` i pokrywa: funkcje pomocnicze (stałe daty), walidację, create/zmianę kwoty/stop/przedłużenie/dismiss, duplikat i jego zwolnienie po stopie, wygasłą definicję, dzień 31 i lata przestępne, izolację dwóch gospodarstw (user B), `anon` oraz kaskadę przy usunięciu gospodarstwa (linie z grepa `select ...`, 24-399). Plik jest dobrym szablonem 1:1; elementy kategorii (kaskada przy usunięciu kategorii, archiwizacja) w wersji dla przychodów odpadają.

### API i serwis

- Serwis `src/lib/services/recurring-expenses.ts`: zod parsuje wiersze z `rpc`, mutacje zwracają `RecurringResult` (`ok` z listą albo `items: null`, gdy zapis się udał, a odczyt nie, `:20-21,51-58`). Wszystkie wywołania `supabase.rpc("..._recurring_expense...")` mają nazwy wydatków wpisane na stałe (`:65-100`).
- `recurringResponse` mapuje `23505`, `23503`, `22023`, `P0002` na komunikaty po polsku (`src/lib/recurring-http.ts:13-25`). Komunikaty są wydatkowe ("Nie znaleziono cyklicznego wydatku"); `23503` w przychodach nie wystąpi.
- Trasy `src/pages/api/recurring-expenses/index.ts` (POST) i `[id].ts` (PATCH z dokładnie jednym z `amount` / `extendMonths` / `dismissReminder`, oraz DELETE) walidują zod; `categoryId` zastąpi `source: z.enum(INCOME_SOURCES, ...)` jak w `src/pages/api/incomes.ts:14`.
- `amountField`, `dayOfMonthField`, `monthsField` (`src/lib/validation.ts`) i `recurring-limits.ts` nie zależą od encji i da się użyć ponownie bez zmian.

### UI

- Strona `/settings/recurring` (`src/pages/settings/recurring.astro`) wczytuje listę i aktywne kategorie, a komponent `RecurringManager` (wyspa `client:load`) renderuje formularz, listę, edycję kwoty w miejscu, "Przedłuż" i dwuetapowe "Zatrzymaj" (`StopControl`). Ścieżka `/settings` jest już chroniona w `PROTECTED_ROUTES` (`src/middleware.ts:4,20`), więc nowa strona pod `/settings/...` nie wymaga zmian w middleware.
- `useRecurringActions` ma na stałe adresy `/api/recurring-expenses` i typ `RecurringExpense` (`:2,93-98`); `isRecurring` sprawdza pola kategorii (`:23-37`). Logika `pending`, błędów per cel, 404 -> przeładowanie jest generyczna.
- `RecurringReminders` (baner na ekranie miesiąca) jest wydatkowy: etykieta sekcji, treść i hook (`RecurringReminders.tsx:27,34,21`). `MonthScreen` dostaje wyłącznie `recurring: RecurringExpense[]` (`MonthScreen.tsx:15,38`), a `dashboard.astro` ładuje tylko `listRecurringExpenses` (`:8,22`).
- `Topbar.astro` ma w menu Ustawienia dokładnie dwa linki (Kategorie, Cykliczne wydatki; `:20-36`). Nowa strona potrzebuje własnego linku albo wspólnej strony.
- `RecurringManager` używa `defaultDay` liczonego po stronie serwera (poprawka `f05ed6d`), żeby formularz zgadzał się z hydratacją; to samo trzeba przenieść.

### Smoke i CI

- `scripts/smoke.mjs` ma kroki dla cyklicznych wydatków: create (dwumiesięczna definicja), dismiss, zmiana kwoty, render strony ustawień, odrzucenie dnia spoza 1-31, stop, przekierowanie po wylogowaniu i odrzucenie anonima (`:200-280,345,365`). Po review S-04 krok renderu sprawdza tekst renderowany tylko przez komponent zarządzający, a nie tekst z Topbara (`impl-review.md` F2); ta sama pułapka dotyczy przychodów, jeśli etykieta strony pokryje się z linkiem w Topbarze.

## Code References

- `supabase/migrations/20261011130000_recurring_expenses.sql:13-66` - tabela, indeks unikalny, FK i polityki (wzorzec)
- `supabase/migrations/20261011130000_recurring_expenses.sql:113-281` - sześć funkcji RPC
- `supabase/migrations/20261011130000_recurring_expenses.sql:283-301` - revoke/grant
- `supabase/migrations/20261008233243_first_expense_and_income.sql:31-40,58-64,115-133` - `incomes`, jej polityki, `month_summary`
- `supabase/tests/database/recurring_expenses.test.sql` - szablon pgTAP (plan(89))
- `src/lib/services/recurring-expenses.ts:20-100` - serwis i `RecurringResult`
- `src/lib/recurring-http.ts:10-26` - mapowanie błędów
- `src/pages/api/recurring-expenses/index.ts`, `[id].ts` - trasy
- `src/hooks/useRecurringActions.ts:54-105` - hook (adresy i typ na sztywno)
- `src/components/settings/RecurringManager.tsx`, `src/components/month/RecurringReminders.tsx` - UI
- `src/components/month/MonthScreen.tsx:15,38`, `src/pages/dashboard.astro:8,22` - baner na ekranie miesiąca
- `src/components/Topbar.astro:20-36` - menu Ustawienia
- `src/lib/validation.ts`, `src/lib/recurring-limits.ts` - pola współdzielone
- `src/types.ts:1,37-58` - `INCOME_SOURCES`, `RecurringExpense`, `RecurringListResponse`
- `scripts/smoke.mjs:200-280` - kroki smoke

## Architecture Insights

- Mechanizm to "materializacja z góry w jednej funkcji SQL = jedna transakcja", bez schedulera (decyzja z `infrastructure.md:17,66`). Zmierzony czas CPU na produkcji dla definicji 24-miesięcznej mieścił się w 10 ms (najwyżej 8 ms przy pierwszym POST po deployu; `archive/2026-10-11-recurring-expenses/plan.md:283-291`). Operacje na wierszach robi baza, więc przychody (ta sama liczba wierszy) nie powinny zmienić tego bilansu; to wniosek z mechanizmu, nie osobny pomiar.
- Konwencja nazw: `recurring_<encja>`, funkcje `<akcja>_recurring_<encja>`. Dla S-05: `recurring_incomes`, `create_recurring_income` itd. Znacznik czasu nowej migracji musi być późniejszy niż `20261011130000`.
- Skopiowana funkcja musi nieść ze sobą poprawki z review S-04: `ON DELETE CASCADE` dotyczy tylko FK do kategorii (nie dotyczy przychodów), natomiast ochrona przed duplikatem (UI `pending` + indeks częściowy + mapowanie 23505) jest wymagana przez lekcję.

## Historical Context (from prior changes)

- `context/archive/2026-10-11-recurring-expenses/plan-brief.md:24,35` - model "osobna tabela + kolumna łącząca", wprost uzasadniony tym, że "S-05 dostaje bliźniaczą tabelę"; cykliczne przychody były poza zakresem S-04. Werdykt: wspiera podejście z dwiema tabelami (nie jedną uogólnioną).
- `.../plan-brief.md:27` - horyzont domyślnie 12, najwyżej 24 miesiące licząc od bieżącego. Nadal obowiązuje w kodzie (`...sql:202`).
- `.../plan-brief.md:55-58` - znane ograniczenia: edycja kwoty nie poprawia wpisu z datą <= dziś (S-06), ręcznie usunięty przyszły wpis wraca przy edycji kwoty, identyczne definicje z tego samego miesiąca są odrzucane. Dla przychodów obowiązują tak samo, bo FR-017 powtarza FR-015.
- `.../reviews/impl-review.md` F1 (kaskada kategorii: nie dotyczy przychodów), F2 (słabe asercje smoke: dotyczy), F3 (ukrywanie akcji wiersza w trakcie edycji: już naprawione w kodzie wydatków, kopiować wersję po poprawce), F4 (404 zamiast 409 w hooku: kod wydatków ma już obsługę 404).
- `context/foundation/lessons.md:7-10,19-24` - `(select current_household_id())` w politykach oraz podwójna ochrona operacji tworzącej.
- Zmiany po merge S-04 w commicie `f05ed6d`: separator dziesiętny w `money.ts`, domyślny dzień po stronie serwera, krótszy komunikat baneru. Kopiować stan z `master`, nie z pierwotnego planu.

## Related Research

- `context/archive/2026-10-11-recurring-expenses/research.md` - badanie S-04 (nie ponawiane tutaj).

## Open Questions

**Rozstrzygnięte 2026-10-12 (po badaniu):** pytanie, czy przychody powinny używać `category_id` zamiast `source`, zostało odłożone. Użytkownik chce własnej listy źródeł przychodu i ujednoliconych formularzy, ale to zmiana wymagań (FR-012), więc trafia do PRD v2 i slice'a S-07 `income-categories` (`roadmap.md`, GitHub #21). S-05 zostaje na `source`, tak jak opisują powyższe ustalenia (brak złożonego FK do `categories`, brak `ON DELETE CASCADE`); zamiana na `category_id` w `incomes` i `recurring_incomes` nastąpi w S-07. Pozostałe ustalenia badania nie zmieniają się.

Decyzje produktowe/projektowe dla `/10x-plan` (kod ich nie rozstrzyga):

1. **Uogólnić czy zduplikować warstwę aplikacji** (hook, `recurringResponse`, serwis, typ, `RecurringManager`, `RecurringReminders`)? Baza i tak dostaje bliźniaczą tabelę i funkcje (potwierdzone w S-04). Duplikacja jest szybsza i izoluje ryzyko; uogólnienie (parametr: encja/URL/etykiety) zmniejsza dryf, ale dotyka działającego kodu S-04.
2. **UI**: osobna strona `/settings/recurring-income` + drugi link w Topbarze, czy jedna strona "Cykliczne" z dwiema sekcjami? Plan S-04 wybrał osobną stronę, żeby nie ruszać szybkiej ścieżki dodawania.
3. **Baner na ekranie miesiąca**: czy przychody mają własny baner "koniec horyzontu" (FR-014 mówi o przypomnieniu dla wydatków; FR-016/017 go nie powtarzają, ale mówią "ta sama reguła")? PRD nie rozstrzyga wprost; `prd.md:96` dotyczy definicji wydatku.
4. **Zakres `source` w definicji**: jedna z pięciu wartości `INCOME_SOURCES` (domyślnie "wynagrodzenie"); czy klucz unikalny ma zawierać `source` (analogicznie do `category_id`)? Rekomendacja robocza: tak.
5. **Dzień miesiąca dla przychodu**: S-04 pozwala wybrać dzień 1-31 (przycinany); FR-016 nie wspomina o dniu, więc to kopia decyzji z S-04, do potwierdzenia.
6. **Pomiar CPU na produkcji** dla przychodów: wniosek z mechanizmu, bez osobnego pomiaru; czy powtarzać krok 4.8 z S-04?
