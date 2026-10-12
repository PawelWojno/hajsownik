# Cykliczne przychody (S-05) Implementation Plan

## Overview

Użytkownik definiuje cykliczny przychód (źródło, kwota, dzień miesiąca, horyzont, domyślnie 12 mies.), a aplikacja od razu tworzy prawdziwe wpisy `incomes`, po jednym na miesiąc, od bieżącego miesiąca. Można zmienić kwotę, przedłużyć horyzont albo zatrzymać definicję. To bliźniak S-04 (FR-016, FR-017), bez schedulera.

## Current State Analysis

- `incomes` ma `source` (CHECK na 5 wartości), `received_on`, tylko polityki SELECT/INSERT (`20261008233243_first_expense_and_income.sql:31-64`). Brak kolumny łączącej wpis z definicją i brak DELETE.
- Wzorzec S-04 jest kompletny i na produkcji: tabela + 6 funkcji `rpc` + pgTAP (`20261011130000_recurring_expenses.sql`), serwis, trasy, hook, `RecurringManager`, `RecurringReminders`, kroki smoke. Funkcje `warsaw_today`, `recurring_slot_date`, `recurring_month_diff` nie zależą od encji (`:73-105`).
- Warstwa aplikacji jest na sztywno wydatkowa: adresy w hooku (`useRecurringActions.ts:93-98`), typ `RecurringExpense`, komunikaty `recurringResponse`, `MonthScreen`/`dashboard.astro` ładują tylko wydatki.
- `month_summary` sumuje `incomes`, więc wygenerowane przychody trafią do „Zostaje” bez zmian.
- Szczegóły i kotwice: `context/changes/recurring-income/research.md`.

## Desired End State

Na `/settings/recurring` jest przełącznik **Wydatki / Przychody** (`?typ=przychody`). Zakładka Przychody pozwala dodać, zmienić kwotę, przedłużyć i zatrzymać cykliczny przychód, a „Zostaje” bieżącego miesiąca od razu uwzględnia wygenerowany wpis. Na ekranie miesiąca osobny, zamykalny baner przypomina o kończącym się horyzoncie przychodu. Weryfikacja: `supabase test db`, `npm run smoke`, ręczny test na telefonie.

### Key Discoveries

- Źródło zostaje `source` (decyzja 2026-10-12, `change.md`): bez złożonego FK do `categories` i bez `ON DELETE CASCADE`; zamiana na `category_id` należy do S-07.
- Lekcje: polityki z `(select public.current_household_id())` (`lessons.md:7-10`); ochrona przed duplikatem w UI (`pending`) i w bazie (częściowy indeks unikalny + mapowanie 23505) (`lessons.md:19-24`).
- Pułapka smoke z review S-04: asercje muszą sprawdzać tekst, którego nie ma Topbar ani drugi baner (`smoke.mjs:263-264`, `:239-241`).

## What We're NOT Doing

- Kategorie przychodów i zmiana `source` → `category_id` (S-07, post-MVP, GitHub #21).
- Edycja źródła, dnia i horyzontu istniejącej definicji; przywracanie zatrzymanych; limit liczby definicji.
- Edycja i usuwanie pojedynczych wpisów (S-06). Manualne przychody pozostają bez UPDATE/DELETE.
- Uogólnianie kodu S-04 (hook, serwis, `RecurringManager`): przychody dostają własne pliki. Kod wydatków zmieniamy tylko tam, gdzie wymaga tego wspólna strona i ekran miesiąca.
- Zmiany w `EntrySheet` i `month_summary`.

## Implementation Approach

Skopiować wzorzec S-04 1:1 dla `incomes`, z trzema różnicami: `source` zamiast kategorii (CHECK, bez `join` w liście), kolumna daty `received_on`, dodana polityka DELETE na `incomes` zawężona do wpisów wygenerowanych. Fazy idą od bazy do UI, każda z własną weryfikacją. `source` występuje w jak najmniejszej liczbie miejsc: kolumna + CHECK, stała `INCOME_SOURCES`, jeden `select` w formularzu.

## Critical Implementation Details

- **Kolejność kroków smoke:** blok przychodów umieść PO kroku `recurring endpoint stops the definition` (wydatek zatrzymany). Krok S-04 „dashboard hides the dismissed reminder” sprawdza brak tekstu „Nie przypominaj”, który mają oba banery; przy aktywnym banerze przychodu przestałby przechodzić. Baner przychodu identyfikuj po `aria-label` („Cykliczne przychody: koniec horyzontu”), a stronę po nagłówku „Twoje cykliczne przychody”.
- **Znacznik czasu migracji** musi być późniejszy niż `20261011130000` (np. `20261012100000_recurring_incomes.sql`). Migrację trzeba wypchnąć na produkcję (`supabase db push`) przed merge, tak jak w S-04.

## Phase 1: Baza + pgTAP

### Overview

Tabela definicji, powiązanie z `incomes`, polityki, 6 funkcji `rpc`, testy.

### Changes Required

#### 1. Migracja

**File**: `supabase/migrations/20261012100000_recurring_incomes.sql`

**Intent**: Bliźniak migracji S-04 dla przychodów, ze wszystkimi regułami dat i horyzontu bez zmian (dzień przycinany do długości miesiąca, „przyszłe” = `received_on > warsaw_today()`, horyzont najwyżej 24 mies. licząc od bieżącego, `p_months` 1..24, wygasła definicja restartuje od bieżącego miesiąca).

**Contract**:
- Tabela `recurring_incomes(id, household_id default current_household_id() → households on delete cascade, source text check in 5 wartości, amount_minor check 1..9999999999, day_of_month 1..31, start_month, end_month, stopped_at, reminder_dismissed_at, created_at, unique(household_id,id))`; polityki SELECT/INSERT/UPDATE z `(select current_household_id())`.
- Częściowy indeks unikalny `(household_id, source, amount_minor, day_of_month, start_month) where stopped_at is null`.
- `incomes.recurring_income_id` + złożony FK `(household_id, recurring_income_id) → recurring_incomes(household_id,id)` + indeks częściowy `(recurring_income_id, received_on)`.
- Polityka `incomes_delete_generated` (DELETE, `recurring_income_id is not null`).
- Funkcje SECURITY INVOKER, `set search_path = ''`, blokada `for no key update`, `P0002` dla braku/cudzej/zatrzymanej: `create_recurring_income(p_source, p_amount_minor, p_day, p_months) → uuid`, `update_recurring_income_amount(p_id, p_amount_minor)`, `extend_recurring_income(p_id, p_months)`, `stop_recurring_income(p_id)`, `dismiss_recurring_income_reminder(p_id)`, `list_recurring_incomes()` (kolumny: id, source, amount_minor, day_of_month, start_month, end_month, months_left, remind).
- `revoke ... from public, anon` + `grant ... to authenticated` dla każdej nowej funkcji.

#### 2. Testy pgTAP

**File**: `supabase/tests/database/recurring_incomes.test.sql`

**Intent**: Pokrycie jak `recurring_expenses.test.sql` (wzorzec fixture: dwa konta, „zegar” z `warsaw_today()`), bez części kategorii.

**Contract**: walidacja (0 i 25 mies., zła `source` → `23514`, kwota 0 → `23514`); create generuje dokładnie `p_months` wpisów w kolejnych miesiącach na przyciętym dniu; zmiana kwoty i stop ruszają tylko wpisy po dziś, nie ruszają wpisów ≤ dziś ani manualnych; duplikat → `23505`, po stopie znów można; przedłużenie, limit 24 mies., wygasła definicja, dismiss; izolacja konta B (`P0002`, DELETE 0 wierszy); `anon` → `42501`; manualne przychody nadal bez UPDATE/DELETE; usunięcie gospodarstwa kaskaduje.

### Success Criteria

#### Automated Verification:

- Migracja i testy przechodzą na lokalnej bazie: `npx supabase db reset && npx supabase test db`
- Lint SQL/format nie psuje commita (husky + `npm run lint`)

#### Manual Verification:

- W `supabase studio` (lokalnie) widać `recurring_incomes` z włączonym RLS i polityki o oczekiwanych nazwach

---

## Phase 2: API i serwis

### Overview

Typy, serwis, mapowanie błędów i trasy; hook w fazie 3.

### Changes Required

#### 1. Typy

**File**: `src/types.ts`

**Intent**: Typ listy cyklicznych przychodów dla strony i baneru.

**Contract**: `RecurringIncome { id, source: IncomeSource, amountMinor, dayOfMonth, startMonth, endMonth, monthsLeft, remind }` oraz `RecurringIncomeListResponse { items: RecurringIncome[] | null }`.

#### 2. Serwis i mapowanie błędów

**File**: `src/lib/services/recurring-incomes.ts`, `src/lib/recurring-income-http.ts`

**Intent**: Powielić `recurring-expenses.ts` i `recurring-http.ts` dla nowych funkcji `rpc`; wiersze parsować zod.

**Contract**: `listRecurringIncomes`, `createRecurringIncome({source, amountMinor, dayOfMonth, months})`, `updateRecurringIncomeAmount`, `extendRecurringIncome`, `stopRecurringIncome`, `dismissRecurringIncomeReminder` zwracają `RecurringResult`-podobny wynik (`ok` z listą albo `items: null` gdy zapis udany, a odczyt nie). Mapowanie: `23505` → „Taka cykliczna pozycja już istnieje”, `22023` → komunikat o 24 miesiącach, `P0002` → 404 „Nie znaleziono cyklicznego przychodu”, reszta → `SAVE_FAILED` 500. Brak `23503`.

#### 3. Trasy

**File**: `src/pages/api/recurring-incomes/index.ts` (POST), `src/pages/api/recurring-incomes/[id].ts` (PATCH z dokładnie jednym z `amount`/`extendMonths`/`dismissReminder`, DELETE)

**Intent**: Jak trasy wydatków; `export const prerender = false`.

**Contract**: body POST `{ source: z.enum(INCOME_SOURCES, "Wybierz źródło przychodu"), amount: amountField, dayOfMonth: dayOfMonthField, months: monthsField }`; ponownie użyć pól z `src/lib/validation.ts`; każda odpowiedź to `{ items }`.

### Success Criteria

#### Automated Verification:

- Typy i lint: `npm run lint` oraz `npx astro check`
- Build przechodzi: `npm run build`

#### Manual Verification:

- `curl` na lokalny serwer z sesją: POST tworzy definicję i zwraca listę, PATCH `amount` zmienia kwotę, DELETE zatrzymuje, zły `source` daje 400, nieistniejące id daje 404

---

## Phase 3: Strona z przełącznikiem

### Overview

Wspólna strona `/settings/recurring` z zakładkami Wydatki / Przychody sterowanymi parametrem w adresie; formularz przychodu.

### Changes Required

#### 1. Hook i komponent

**File**: `src/hooks/useRecurringIncomeActions.ts`, `src/components/settings/RecurringIncomeManager.tsx`

**Intent**: Duplikat logiki `useRecurringActions` / `RecurringManager` (stan `pending`, błędy per cel, 404 lub `items: null` → przeładowanie) z `select` źródła (z `INCOME_SOURCES`) zamiast kategorii.

**Contract**: wersja po poprawkach z `f05ed6d` (domyślny dzień z serwera, separator dziesiętny). Parser odpowiedzi w hooku (odpowiednik `isRecurring`/`isRecurringList`, `useRecurringActions.ts:23-40`) sprawdza pola `RecurringIncome` (`id`, `source`, `amountMinor`, `dayOfMonth`, `startMonth`, `endMonth`, `monthsLeft`, `remind`), a nie pola kategorii; działa na `unknown`, więc kompilator tego nie wyłapie. Akcje wiersza ukryte w trakcie edycji kwoty; dwuetapowe „Zatrzymaj”; „Przedłuż” ograniczone do 24 mies. od bieżącego; nagłówki „Cykliczne przychody” / „Twoje cykliczne przychody”.

#### 2. Strona i przełącznik

**File**: `src/pages/settings/recurring.astro`

**Intent**: `?typ=przychody` wczytuje i renderuje `RecurringIncomeManager`, każda inna wartość (lub brak) działa jak dotąd dla wydatków. Serwer wczytuje tylko aktywną listę. Nad wyspą dwa linki-zakładki z `aria-current`. `title` strony (`recurring.astro:24`) i akapit błędu odczytu (`:39`) zależą od `typ`: dla przychodów „Hajsownik — cykliczne przychody” i „Nie udało się wczytać cyklicznych przychodów”; bez parametru zostają dotychczasowe napisy o wydatkach.

**Contract**: `/settings/recurring` zachowuje dotychczasowe zachowanie; ścieżka pozostaje pod `/settings` (ochrona w `middleware.ts:4` bez zmian).

#### 3. Menu

**File**: `src/components/Topbar.astro`

**Intent**: Link w menu Ustawienia zmienia etykietę z „Cykliczne wydatki” na „Cykliczne”.

### Success Criteria

#### Automated Verification:

- `npm run lint` i `npx astro check` przechodzą
- `npm run build` przechodzi

#### Manual Verification:

- Przełączanie zakładek działa i adres się zmienia; dodanie, zmiana kwoty, przedłużenie, zatrzymanie przychodu działają, „Zostaje” bieżącego miesiąca rośnie o wpis z datą ≤ dziś
- Podwójne kliknięcie „Dodaj” tworzy jedną definicję; identyczna druga pokazuje komunikat po polsku
- Ekran 360 px: przełącznik i akcje mają min. 44 px; strona wydatków działa jak przed zmianą

---

## Phase 4: Baner, smoke, domknięcie

### Overview

Baner na ekranie miesiąca, kroki smoke, wdrożenie migracji, krótki pomiar CPU.

### Changes Required

#### 1. Baner

**File**: `src/components/month/RecurringIncomeReminders.tsx`, `src/components/month/MonthScreen.tsx`, `src/pages/dashboard.astro`

**Intent**: Baner „koniec horyzontu” dla przychodów obok banera wydatków, z „Przedłuż o 12 mies.” i „Nie przypominaj”. Dashboard ładuje `listRecurringIncomes` w tym samym `Promise.allSettled` (błąd nie wywraca ekranu), `MonthScreen` dostaje prop `recurringIncomes`.

**Contract**: sekcja z `aria-label="Cykliczne przychody: koniec horyzontu"`; pojawia się, gdy `remind` (0 lub 1 miesiąc do końca), znika po „Nie przypominaj”.

#### 2. Smoke

**File**: `scripts/smoke.mjs`

**Intent**: Kroki przychodów po bloku wydatków: create (dwumiesięczna, `source: "wynagrodzenie"`, dzień 1), dashboard pokazuje baner przychodu (po `aria-label` i „Zostaje”), dismiss, dashboard bez banera, zmiana kwoty, strona `/settings/recurring?typ=przychody` (nagłówek „Twoje cykliczne przychody”), odrzucenie złego `source`/dnia 32, stop, przekierowanie anonima i 401 anonima na trasie przychodów.

#### 3. Domknięcie

**Intent**: `supabase db push` na produkcję przed merge; po deployu krótki pomiar CPU (definicja 24-miesięczna, potem zmiana kwoty) w logach Cloudflare, limit 10 ms (`infrastructure.md:96`); wynik zapisać w planie. Gałąź + PR (zmiana kodu).

### Success Criteria

#### Automated Verification:

- `npm run lint`, `npx astro check`, `npm run build`
- `supabase test db` zielone
- `npm run smoke` przechodzi na buildzie (preview) z lokalnym Supabase

#### Manual Verification:

- Baner pojawia się dla definicji kończącej się w tym lub następnym miesiącu i można go zamknąć na stałe
- Na produkcji pełny cykl create → zmiana → zatrzymanie na telefonie; pomiar CPU poniżej 10 ms lub odnotowane odstępstwo

---

## Testing Strategy

### Unit / DB (pgTAP):
- Reguły dat (dzień 31, luty, rok przestępny), granica „dziś”, limit 24 mies., duplikaty, RLS i izolacja, anon.

### Integration (smoke):
- Pełny cykl API + render strony i banera na buildzie.

### Manual Testing Steps:
1. Dodaj przychód z dniem 31 na 12 mies., sprawdź daty (28/29 lutego).
2. Zmień kwotę w środku miesiąca: wpis z datą ≤ dziś zostaje, przyszłe mają nową kwotę.
3. Zatrzymaj: przyszłe znikają, przeszłe zostają, „Zostaje” zgodne.
4. Dwie karty: zatrzymaj w jednej, w drugiej akcja kończy się przeładowaniem (404).

## Performance Considerations

Każda akcja to jedno wywołanie `rpc` (≤ 24 wiersze). CPU Workera w S-04 mieścił się w 10 ms (maks. 8 ms przy pierwszym POST po deployu); przychody powinny być podobne, co potwierdza krótki pomiar w fazie 4.

## Migration Notes

Migracja addytywna (nowa tabela, nowa nullowalna kolumna w `incomes`); bez backfillu. Brak wpływu na istniejące wpisy. Przy S-07 kolumna `source` w `recurring_incomes` zostanie zamieniona na `category_id`.

## References

- Related research: `context/changes/recurring-income/research.md`
- Wzorzec: `supabase/migrations/20261011130000_recurring_expenses.sql`, `src/lib/services/recurring-expenses.ts:20-100`, `src/hooks/useRecurringActions.ts`, `src/components/settings/RecurringManager.tsx`, `src/components/month/RecurringReminders.tsx`
- Archiwum: `context/archive/2026-10-11-recurring-expenses/plan.md`
- Lekcje: `context/foundation/lessons.md`

## Progress

> Convention: `- [ ]` pending, `- [x]` done. Append ` — <commit sha>` when a step lands. Do not rename step titles.

### Phase 1: Baza + pgTAP

#### Automated

- [x] 1.1 Migracja i testy przechodzą na lokalnej bazie: `npx supabase db reset && npx supabase test db` — 923dff1
- [x] 1.2 Lint SQL/format nie psuje commita (husky + `npm run lint`) — 923dff1

#### Manual

- [x] 1.3 W `supabase studio` widać `recurring_incomes` z włączonym RLS i polityki o oczekiwanych nazwach — 923dff1

### Phase 2: API i serwis

#### Automated

- [x] 2.1 Typy i lint: `npm run lint` oraz `npx astro check` — e3ab842
- [x] 2.2 Build przechodzi: `npm run build` — e3ab842

#### Manual

- [x] 2.3 `curl` z sesją: POST tworzy definicję, PATCH zmienia kwotę, DELETE zatrzymuje, zły `source` daje 400, nieistniejące id daje 404 — e3ab842

### Phase 3: Strona z przełącznikiem

#### Automated

- [x] 3.1 `npm run lint` i `npx astro check` przechodzą
- [x] 3.2 `npm run build` przechodzi

#### Manual

- [x] 3.3 Przełączanie zakładek działa; dodanie, zmiana kwoty, przedłużenie, zatrzymanie przychodu działają, „Zostaje” rośnie o wpis z datą ≤ dziś
- [x] 3.4 Podwójne kliknięcie „Dodaj” tworzy jedną definicję; identyczna druga pokazuje komunikat po polsku
- [x] 3.5 Ekran 360 px: przełącznik i akcje mają min. 44 px; strona wydatków działa jak przed zmianą

### Phase 4: Baner, smoke, domknięcie

#### Automated

- [ ] 4.1 `npm run lint`, `npx astro check`, `npm run build`
- [ ] 4.2 `supabase test db` zielone
- [ ] 4.3 `npm run smoke` przechodzi na buildzie (preview) z lokalnym Supabase

#### Manual

- [ ] 4.4 Baner pojawia się dla definicji kończącej się w tym lub następnym miesiącu i można go zamknąć na stałe
- [ ] 4.5 Na produkcji pełny cykl create → zmiana → zatrzymanie na telefonie; pomiar CPU poniżej 10 ms lub odnotowane odstępstwo
