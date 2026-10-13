# Historia wpisów z edycją i usuwaniem (S-06) Implementation Plan

## Overview

Użytkownik dostaje stronę `/history` z listą wydatków i przychodów wybranego miesiąca (filtr miesiąca, a dla wydatków także kategorii) i może edytować albo usunąć dowolny wpis, ręczny lub wygenerowany z cyklu, bez zatrzymywania definicji (FR-018, FR-019, FR-020). Strzałki `‹ ›` zmieniają miesiąc na stronie historii, a tytuł „Miesiąc Rok” na ekranie miesiąca jest linkiem do historii bieżącego miesiąca. W edycji kwoty cyklu aplikacja podpowiada, że zmiana nadpisze przyszłe wpisy.

## Current State Analysis

- Nic nie czyta listy wpisów: jedyne odwołania do `expenses`/`incomes` w `src/` to INSERT-y (`api/expenses.ts:39`, `api/incomes.ts:37`); reszta czyta sumy przez `month_summary` (`services/month.ts:9-30`).
- RLS na obu tabelach: SELECT, INSERT i wąskie DELETE tylko dla wierszy z `recurring_*_id` (`20261011130000_recurring_expenses.sql:64-66`, `20261012100000_recurring_incomes.sql:63-65`). Brak UPDATE. Asercje default-deny: `expenses_income.test.sql:100-104`.
- RPC cykliczne rozróżniają przyszłość tylko datą (`spent_on > warsaw_today()`): zmiana kwoty usuwa i generuje od nowa wszystkie wygenerowane wpisy po dziś, stop je usuwa (`20261011130000:143-174, 216-233`; analogicznie przychody). Wpis nie ma znacznika „edytowany”, więc ręcznie zmieniony przyszły wpis zostanie nadpisany po zmianie kwoty cyklu (świadomie zostawiamy, patrz „What We're NOT Doing”).
- `dateField` odrzuca przyszłość (`validation.ts:28-31`), a wygenerowane wpisy mogą być w przyszłości.
- `dashboard.astro` pokazuje tylko bieżący miesiąc (`currentMonthStart()`); tytuł `h1` z nazwą miesiąca jest w `MonthScreen.tsx`. Ekran miesiąca zostaje bez zmian poza zamianą tytułu w link.
- Gotowe wzorce: trasy `[id].ts` (`api/categories/[id].ts:18-51`), serwis → `*-http.ts` → hook z `pending` i błędem per wiersz (`useRecurringActions.ts:51-91`), dwuetapowe potwierdzenie inline (`CategoryManager.tsx:25-71`, `RecurringManager.tsx:85-128`), zakładki linkami SSR (`settings/recurring.astro:44-58`), pigułka „zarchiwizowana” (`CategoryManager.tsx:245-278`).
- Szczegóły i kotwice: `context/changes/expense-history-and-edits/research.md`.

## Desired End State

- `/history?typ=wydatki|przychody&month=YYYY-MM&kategoria=<uuid>`: lista wpisów miesiąca od najnowszych (limit 200 na rodzaj), z sumami miesiąca nad listą, oznaczeniami „cykliczny”, „zaplanowany” (data po dziś) i „zarchiwizowana”. Filtr kategorii działa na zakładce Wydatki; na Przychodach go nie ma, a w wierszu widać źródło.
- Każdy wpis można edytować i usunąć. Wpis cykliczny: edytowalne tylko kwota i opis (data i kategoria zablokowane); usunięcie lub edycja nie zatrzymuje definicji.
- Link „Historia” w Topbar. Na `/history` etykieta „Miesiąc Rok” ma po bokach strzałki `‹ ›` (miesiąc ±1, w tym przyszłe). Na `/dashboard` tytuł „Miesiąc Rok” jest linkiem do `/history?month=<bieżący miesiąc>`; ekran miesiąca poza tym bez zmian (zawsze bieżący miesiąc, bez strzałek).
- W edycji kwoty cyklu (`/settings/recurring`, zakładki Wydatki i Przychody) widać stałą podpowiedź: „Zmiana kwoty cyklu nadpisze przyszłe wpisy.”
- Weryfikacja: `npx supabase test db`, `npm run lint`, `npx astro check`, `npm run build`, `npm run smoke`, ręczny test na telefonie.

### Key Discoveries

- Zasada „wpis cykliczny = tylko kwota” trafia do triggera `BEFORE UPDATE`, więc żadna ścieżka zapisu jej nie obejdzie; RPC cykliczne tylko usuwają i wstawiają wiersze, więc trigger ich nie dotyka.
- Nazwy kategorii i status archiwum dołączamy w TypeScript z `listCategories` (potrzebnego i tak do filtra), zamiast osadzać `categories(...)` przez klucz kompozytowy, co nie zostało zweryfikowane (`research.md`, pytanie 7).
- Lekcja `lessons.md:5-10`: każda nowa polityka RLS używa `(select public.current_household_id())`. Lekcja o ochronie przed duplikatem dotyczy operacji tworzących, więc nie dotyczy edycji/usuwania, ale hooki dalej blokują przyciski na czas żądania (`pending`).
- Dla S-07: etykieta przychodu powstaje w jednej funkcji (`entryLabel`), parametr filtra kategorii ma stałą nazwę `kategoria`, a miejsc ze `source` dokładamy minimum (schemat edycji przychodu, jedna etykieta, jedno pole formularza).
- Pułapka z review S-04: asercje smoke muszą sprawdzać tekst, którego nie ma Topbar ani inne bannery (`research.md`, wątek smoke).

## What We're NOT Doing

- Kategorie przychodów i zmiana `source` → `category_id` (S-07). Filtr kategorii na liście przychodów.
- Zmiana kategorii, dnia lub horyzontu definicji cyklicznej; zmiana daty/kategorii wpisu cyklicznego (zablokowane).
- Znacznik „ręcznie usunięty” dla wpisów cyklicznych: ręcznie usunięty przyszły wpis nadal wraca po zmianie kwoty definicji (zachowanie z S-04, `plan-brief.md:56` tamtej zmiany); komunikat przy usuwaniu to wyjaśnia.
- Znacznik „edytowany” (`edited_at`) i licznik zmienionych wpisów z ostrzeżeniem przed zmianą kwoty/stopem: zamiast tego stała podpowiedź w edycji kwoty cyklu. Zmieniony ręcznie przyszły wpis jest po zmianie kwoty cyklu nadpisywany (zachowanie z S-04); `list_recurring_*` i ich uprawnienia bez zmian.
- Strzałki, parametr `?month=` i tryb tylko do odczytu na ekranie miesiąca: `/dashboard` zawsze pokazuje bieżący miesiąc, a jedyną zmianą jest link w tytule; `MonthScreen` nie dostaje trybu `readOnly`.
- Stronicowanie (jest limit 200 wierszy na rodzaj z komunikatem), filtr po osobie lub zakresie dat, podsumowanie per kategoria (zaparkowane w roadmapie), „szybkie ponowienie wydatku”.
- Zmiany kontraktu `buildSavedResponse`/`SavedEntryResponse` i RPC cyklicznych.
- Opis w definicji cyklu (`recurring_expenses`/`recurring_incomes`) i dziedziczenie go przez generowane wpisy: planowane w przyszłości (decyzja 2026-10-13). Na razie wpisy cykliczne mają opis wyłącznie edytowany ręcznie w historii; ponieważ zmiana kwoty cyklu usuwa i generuje przyszłe wpisy od nowa, taki opis jest wtedy tracony (do czasu opisu w definicji).
- Dodatkowy indeks `(household_id, category_id, spent_on)`: wystarczy istniejący `(household_id, spent_on)` przy zakresie jednego miesiąca.

## Implementation Approach

Od dołu: najpierw baza z testami (trigger blokujący kolumny wpisów cyklicznych, polityki UPDATE/DELETE), potem serwis i trasy, strona historii z nawigacją, edycja/usuwanie w UI, na końcu podpowiedź w menedżerach cykli, smoke i roadmapa. Lista jest renderowana na serwerze (SSR) i hydratowana jedną wyspą `HistoryList`; po edycji lub usunięciu wyspa pobiera świeże dane z `GET /api/history` (ten sam serwis co SSR), a gdy odczyt zawiedzie, przeładowuje stronę. Edycja używa uogólnionego `EntrySheet` (tryb edycji z wartościami początkowymi). Walidacja kategorii archiwalnej: serwer odrzuca zmianę na zarchiwizowaną kategorię innego niż dotychczasowy `category_id`.

## Faza 1: Baza danych i testy pgTAP

### Overview

Odblokowuje UPDATE i DELETE ręcznych wpisów i wymusza w bazie regułę „wpis cykliczny = tylko kwota”.

### Changes Required:

#### 1. Migracja `supabase/migrations/20261012180000_entry_edit_delete.sql`

**File**: `supabase/migrations/20261012180000_entry_edit_delete.sql`

**Intent**: Dodać trigger pilnujący zasad edycji oraz polityki UPDATE i DELETE dla gospodarstwa.

**Contract**:
- Funkcja triggera `BEFORE UPDATE` dla każdej tabeli, z jawną listą zablokowanych kolumn porównywanych przez `IS DISTINCT FROM` (bez porównywania całego wiersza): `household_id`, `recurring_*_id`, `created_at` nie mogą się zmienić nigdy; dla wiersza z `recurring_*_id is not null` zmiana `category_id`, `spent_on` (wydatki) albo `source`, `received_on` (przychody) rzuca wyjątek z kodem `22023`. Zmiana `amount_minor` oraz `description` (wydatki) jest dozwolona.
- Usunąć polityki `expenses_delete_generated` i `incomes_delete_generated`; dodać `expenses_update`, `expenses_delete`, `incomes_update`, `incomes_delete` (`to authenticated`; `using` i dla UPDATE `with check` z `household_id = (select public.current_household_id())`).
- Bez zmian w funkcjach `list_recurring_*` i bez nowych kolumn.

#### 2. Testy pgTAP

**File**: `supabase/tests/database/expenses_income.test.sql`, `recurring_expenses.test.sql`, `recurring_incomes.test.sql`, nowy `entry_edit_delete.test.sql`

**Intent**: Zamienić asercje default-deny na asercje nowego zachowania i pokryć trigger i izolację gospodarstw.

**Contract**: Asercje do zmiany: `expenses_income.test.sql:101-104` (UPDATE i DELETE bez `WHERE` zmieniłyby i usunęły wszystkie wpisy A, co zepsułoby też `:106`, `:108-117`; nowe asercje celują w jeden wiersz dodany na potrzeby testu, po `id`), `recurring_expenses.test.sql:178-181` i `recurring_incomes.test.sql:177-180` (default-deny dla ręcznych wpisów → UPDATE/DELETE jednego wiersza po `id` działa). Opisy asercji „narrow DELETE policy” (`recurring_expenses.test.sql:269`, `recurring_incomes.test.sql:266`) zaktualizować. `plan(n)`: `expenses_income` 29, `recurring_expenses` 89, `recurring_incomes` 83 plus dodane asercje.

**Contract (nowy `entry_edit_delete.test.sql`)**: Przypadki: (a) A edytuje i usuwa swój ręczny wpis (1 wiersz), B nie widzi/nie zmienia wpisu A (0 wierszy); (b) UPDATE daty/kategorii/źródła wpisu cyklicznego → `22023`, UPDATE jego kwoty i opisu działa; (c) UPDATE kwoty i daty wpisu ręcznego działa; (d) zmiana `recurring_*_id` lub `household_id` odrzucona; (e) DELETE wpisu cyklicznego nie zatrzymuje definicji (`stopped_at` null) i nie dotyka kolejnych wpisów.

### Success Criteria:

#### Automated Verification:

- Migracja stosuje się czysto: `npx supabase db reset`
- Testy pgTAP przechodzą: `npx supabase test db`

#### Manual Verification:

- W Supabase Studio: UPDATE kwoty wygenerowanego wpisu przechodzi, a UPDATE jego daty kończy się błędem `22023`.

**Implementation Note**: Po fazie i zielonych testach zatrzymaj się na ręczne potwierdzenie przed następną fazą.

---

## Faza 2: Warstwa serwerowa (serwis, trasy, typy)

### Overview

Odczyt listy z filtrami oraz edycja i usuwanie wpisów przez API, z regułami domenowymi.

### Changes Required:

#### 1. Walidacja, daty i typy

**File**: `src/lib/validation.ts`, `src/lib/dates.ts`, `src/types.ts`

**Intent**: Wyeksportować współdzielone schematy wpisów i dodać helpery miesięcy oraz typy historii.

**Contract**:
- `validation.ts`: eksportowane `expenseCreateSchema`/`incomeCreateSchema` (przeniesione z tras, bez zmiany zachowania POST) oraz `expensePatchSchema` (`amount` wymagane; `categoryId`, `date`, `description` opcjonalne; `date` przez `dateField`) i `incomePatchSchema` (`amount` wymagane; `source`, `date` opcjonalne). Dla PATCH wpisu cyklicznego klient wysyła samą kwotę.
- `dates.ts`: `parseMonthParam(value) → "YYYY-MM-01" | null` (prawdziwa data, rok 2000–2100), `monthParam(monthStart) → "YYYY-MM"`, `shiftMonth(monthStart, delta)`, `nextMonthStart(monthStart)`.
- `types.ts`: `HistoryEntry { id, kind: "expense" | "income", amountMinor, date, label, categoryId: string | null, categoryArchived: boolean, description: string | null, recurring: boolean, planned: boolean }`; `HistoryResponse { entries: HistoryEntry[] | null, summary: MonthSummary | null, truncated: boolean }`; `EntryOkResponse { ok: true }`.

#### 2. Serwis wpisów

**File**: `src/lib/services/entries.ts`

**Intent**: Jedno miejsce na odczyt historii oraz edycję i usunięcie, w stylu `{ ok, ... } | { ok: false, code }` z `categories.ts`.

**Contract**:
- `listHistory(supabase, { kind, month, categoryId? })`: zapytanie po zakresie `[month, nextMonthStart)`, sort `spent_on|received_on desc, created_at desc, id desc`, `limit 201` (`truncated` gdy zwrócono 201); kategorie z `listCategories`; `label` z jednej funkcji `entryLabel(entry, categories)` (wydatek: nazwa kategorii; przychód: `source`); `planned = date > todayInWarsaw()`; `summary` przez `getMonthSummary`.
- `updateExpense(supabase, id, patch)`: jeśli podano `categoryId`, odczytaj dotychczasowy `category_id` wpisu i `archived_at` docelowej kategorii; odrzuć (`archived_category`), gdy cel jest zarchiwizowany i różni się od dotychczasowej. `.update(...).eq("id", id).select("id")`; pusty wynik = `not_found`. Wzorzec: `categories.ts:139-160`. `updateIncome` analogicznie, bez kategorii.
- `deleteEntry(supabase, kind, id)`: `.delete().eq("id", id).select("id")`, pusty wynik = `not_found`.

#### 3. Trasy API

**File**: `src/pages/api/expenses/index.ts` (przeniesiony `expenses.ts`), `src/pages/api/expenses/[id].ts`, `src/pages/api/incomes/index.ts`, `src/pages/api/incomes/[id].ts`, `src/pages/api/history.ts`, `src/lib/entry-http.ts`, `src/lib/http.ts`

**Intent**: Wystawić PATCH/DELETE na wpisach i GET historii, zachowując adres `/api/expenses` i `/api/incomes` dla POST.

**Contract**:
- Stare `src/pages/api/expenses.ts` i `incomes.ts` usunąć w tym samym kroku, w którym powstają `expenses/index.ts` i `incomes/index.ts` (inaczej kolizja tras pod jednym adresem).
- `[id].ts`: kopia wzorca `categories/[id].ts` (`prerender = false`, `z.uuid()` na parametr, auth → 401, `readJson`, zod → 400 z `issues[0].message`). PATCH zwraca `EntryOkResponse`; DELETE zwraca `EntryOkResponse`.
- `history.ts` `GET` sam sprawdza `context.locals.user` (401), bo middleware chroni tylko strony; parametry `typ`, `month`, `kategoria` walidowane zodem z bezpiecznymi domyślnymi (zła wartość → domyślna), zwraca `HistoryResponse`.
- `entry-http.ts`: mapowanie `not_found` → 404 „Nie znaleziono wpisu”, `22023` → 400 „Wpis z cyklu: można zmienić tylko kwotę”, `archived_category` → 400 „Ta kategoria jest zarchiwizowana”, `23503` → 400 „Wybierz kategorię z listy”, reszta → 500 `SAVE_FAILED`.
- `http.ts`: dopisać `HistoryResponse | EntryOkResponse` do unii `json()`.

### Success Criteria:

#### Automated Verification:

- Linting przechodzi: `npm run lint`
- Sprawdzenie typów przechodzi: `npx astro check`
- Build przechodzi: `npm run build`

#### Manual Verification:

- Zalogowany użytkownik otwiera `/api/history?typ=wydatki&month=2026-10` i dostaje JSON z wpisami oraz sumami miesiąca.

**Implementation Note**: Zatrzymaj się na potwierdzenie przed fazą 3.

---

## Faza 3: Nawigacja i strona historii (SSR, odczyt)

### Overview

Link w menu, link w tytule ekranu miesiąca oraz lista historii ze strzałkami miesiąca, bez akcji edycji.

### Changes Required:

#### 1. Nawigacja i ochrona trasy

**File**: `src/components/Topbar.astro`, `src/middleware.ts`, `src/components/month/MonthScreen.tsx`, `src/pages/dashboard.astro`

**Intent**: Wejście do historii z menu i z tytułu ekranu miesiąca.

**Contract**: `Topbar`: link „Historia” obok „Miesiąc”. `PROTECTED_ROUTES` + `"/history"`. `dashboard.astro` przekazuje do `MonthScreen` prop `historyHref` (`/history?month=` + `monthParam(currentMonthStart())`), a `MonthScreen` renderuje tytuł `h1` jako link do tego adresu (tekst bez zmian, `min-h-11` na obszarze dotyku). Poza tym `dashboard.astro` i `MonthScreen` bez zmian: bez `?month=`, strzałek i trybu tylko do odczytu.

#### 2. Strona historii

**File**: `src/pages/history.astro`, `src/components/history/HistoryList.tsx`

**Intent**: Lista wpisów wybranego miesiąca z zakładkami, filtrem i oznaczeniami.

**Contract**: Strona czyta `typ` (domyślnie wydatki), `month`, `kategoria` (zod, złe → domyślne), wywołuje `listHistory`, renderuje nagłówek miesiąca (`<h1>` z etykietą „Miesiąc Rok” i po bokach linki-strzałki `‹ ›` ze `shiftMonth ∓1`, `aria-label` „Poprzedni/Następny miesiąc”, `min-h-11`; strzałki zachowują `typ` i `kategoria`), zakładki Wydatki/Przychody jak w `settings/recurring.astro:44-58` oraz `<form method="get">` z `select` kategorii (wszystkie kategorie, także zarchiwizowane z dopiskiem) tylko na zakładce Wydatki. Nad listą: przychody, wydatki, zostaje miesiąca. `HistoryList` (wyspa `client:load`) dostaje wpisy, `params` (`typ`, `month`, `kategoria`, potrzebne do `refresh()`) oraz listę kategorii (do edycji), i renderuje wiersze: data, etykieta, opis, kwota, pigułki „cykliczny”, „zaplanowany”, „zarchiwizowana”. Przy `truncated` komunikat „Pokazano 200 wpisów — zawęź filtr kategorii.”; przy pustej liście komunikat po polsku; przy błędzie odczytu `role="alert"` jak w `dashboard.astro`. Układ `max-w-md`, bez poziomego przewijania.

### Success Criteria:

#### Automated Verification:

- Linting przechodzi: `npm run lint`
- Sprawdzenie typów przechodzi: `npx astro check`
- Build przechodzi: `npm run build`

#### Manual Verification:

- Strzałki zmieniają miesiąc na `/history` (także na przyszłe miesiące i przez granicę roku), a tytuł na `/dashboard` prowadzi do historii bieżącego miesiąca.
- Filtr kategorii zawęża wydatki; zarchiwizowana kategoria jest oznaczona; wpisy cykliczne w przyszłości mają „zaplanowany”.
- Widok jest czytelny na telefonie bez poziomego przewijania.

**Implementation Note**: Zatrzymaj się na potwierdzenie przed fazą 4. Po `npm run build` zrestartuj serwer dev i odśwież stronę twardo.

---

## Faza 4: Edycja i usuwanie w UI

### Overview

Akcje na wierszach historii: edycja w uogólnionym `EntrySheet` i usunięcie z potwierdzeniem.

### Changes Required:

#### 1. Tryb edycji w `EntrySheet` i hooku

**File**: `src/components/month/EntrySheet.tsx`, `src/hooks/useEntrySubmit.ts`

**Intent**: Ten sam panel obsługuje dodawanie i edycję bez regresji szybkiego dodawania.

**Contract**: Nowy opcjonalny prop `entry` (`id`, `kind`, wartości początkowe, `recurring`, nazwa kategorii). Gdy `entry` jest ustawione: formularz startuje z tymi wartościami (`formatMinorForInput`), tytuł „Edytuj wpis”, zapis to `PATCH /api/{expenses|incomes}/{id}`, po sukcesie panel się zamyka bez resetu i bez trybu szybkiego wpisywania, nagłówek „Zostaje w tym miesiącu” znika. Dla `recurring` aktywne są tylko kwota i opis (wydatki); data i kategoria są pokazane jako tekst tylko do odczytu, a PATCH niesie kwotę i opis. Lista kategorii w edycji: aktywne plus dotychczasowa (jeśli zarchiwizowana). `useEntrySubmit` dostaje wariant edycji (metoda, adres, walidator odpowiedzi `EntryOkResponse`) bez zmiany ścieżki POST.

#### 2. Akcje na wierszach historii

**File**: `src/hooks/useHistoryActions.ts`, `src/components/history/HistoryList.tsx`

**Intent**: Edycja i usunięcie z odświeżeniem listy.

**Contract**: Hook zwraca `{ entries, summary, truncated, pending, error: { target, message } | null, clearError, remove(id), refresh() }`. Po udanym PATCH/DELETE `refresh()` wywołuje `GET /api/history` z bieżącymi parametrami strony; błąd odczytu lub 404 → `window.location.reload()`. Gdy edycja zmieniła datę ręcznego wpisu na inny miesiąc, wpis znika z listy, więc wyspa pokazuje komunikat „Przeniesiono do {miesiąc}”. Wiersz ma przyciski „Edytuj” i „Usuń” (`min-h-11`); „Usuń” używa dwuetapowego potwierdzenia inline jak `CategoryManager.tsx:25-71` (przyciski blokowane przez `pending`). Dla wpisu cyklicznego tekst potwierdzenia: „Na pewno? Cykl nadal będzie generował kolejne wpisy — zatrzymasz go w Ustawienia → Cykliczne.” Dla ręcznego: „Na pewno? Nie można cofnąć.”

### Success Criteria:

#### Automated Verification:

- Linting przechodzi: `npm run lint`
- Sprawdzenie typów przechodzi: `npx astro check`
- Build przechodzi: `npm run build`

#### Manual Verification:

- Edycja kwoty/daty/kategorii ręcznego wydatku i kwoty/źródła przychodu odświeża listę i sumy miesiąca.
- Wpis cykliczny pozwala zmienić tylko kwotę i opis; data i kategoria są tylko do odczytu.
- Usunięcie pojedynczego wpisu cyklicznego nie zatrzymuje definicji (kolejne wpisy dalej istnieją).
- Edycja wpisu w zarchiwizowanej kategorii nie wymusza zmiany kategorii; wybór innej zarchiwizowanej jest odrzucony.
- Dodawanie wydatku z ekranu miesiąca działa jak wcześniej (reset i fokus po zapisie).

**Implementation Note**: Zatrzymaj się na potwierdzenie przed fazą 5.

---

## Faza 5: Podpowiedź w menedżerach cykli, smoke i domknięcie

### Overview

Stała podpowiedź przy edycji kwoty cyklu, testy end-to-end przez API i aktualizacja dokumentów.

### Changes Required:

#### 1. Podpowiedź w edycji kwoty cyklu

**File**: `src/components/settings/RecurringManager.tsx`, `src/components/settings/RecurringIncomeManager.tsx`

**Intent**: Uprzedzić użytkownika, że zmiana kwoty cyklu nadpisze przyszłe wpisy, także te poprawione ręcznie w historii.

**Contract**: W trybie edycji kwoty definicji (inline, obok pola kwoty) stały tekst „Zmiana kwoty cyklu nadpisze przyszłe wpisy.” w stylu istniejących podpowiedzi (`text-xs`, kolor jak `FieldError` bez ikony ostrzeżenia). Bez dodatkowego kroku potwierdzenia, bez zmian w typach, serwisach, hookach i RPC. Tekst potwierdzenia zatrzymania cyklu („Wygenerowane przyszłe wpisy zostaną usunięte.”) już istnieje i zostaje.

#### 2. Smoke i dokumentacja

**File**: `scripts/smoke.mjs`, `context/foundation/roadmap.md`

**Intent**: Pokryć nowe API i stronę historii oraz zamknąć wpis roadmapy.

**Contract**: Nowe kroki w stylu pliku: dodaj wydatek → `GET /api/history` go zawiera → `PATCH` kwoty → `DELETE` → brak na liście; `GET /history` zwraca HTML z prawdziwym tekstem (etykieta miesiąca, kategoria, kwota), bez `[object Object]` (ryzyko z `infrastructure.md`); utwórz cykl → wpis z kolejnego miesiąca (`GET /api/history?month=` następnego): `PATCH` kategorii → 400, `PATCH` kwoty → 200; `GET /dashboard` zawiera link do `/history?month=` bieżącego miesiąca. Nowe kroki stoją po asercjach `leftFrom` (`smoke.mjs:192, :200`, zakładają pusty bieżący miesiąc) i przed końcowym anonimowym POST-em (`:479-485`). Asercje tekstowe nie mogą trafiać w Topbar: sprawdzaj etykietę miesiąca (np. „Październik 2026”), nie „Historia” ani „Miesiąc”. Roadmap: status S-06 wg konwencji skilli (`planning` → `in-progress` → `done`).

### Success Criteria:

#### Automated Verification:

- Linting przechodzi: `npm run lint`
- Sprawdzenie typów przechodzi: `npx astro check`
- Build przechodzi: `npm run build`
- Testy pgTAP przechodzą: `npx supabase test db`
- Smoke przechodzi na działającym serwerze: `npm run smoke`

#### Manual Verification:

- W edycji kwoty cyklu (wydatki i przychody) widać „Zmiana kwoty cyklu nadpisze przyszłe wpisy.”; po zmianie kwoty przyszłe wpisy, także poprawione ręcznie, mają kwotę definicji.
- Cały przepływ działa na telefonie (dodanie, historia, edycja, usunięcie).

**Implementation Note**: To ostatnia faza; po niej gotowość do `/10x-impl-review`.

---

## Testing Strategy

### Unit Tests:

- Brak frameworka testów jednostkowych w repo; logikę domenową pokrywa pgTAP (trigger, polityki), a helpery dat (`parseMonthParam`, `shiftMonth`, `nextMonthStart`) są sprawdzane przez smoke i ręcznie na granicach roku (grudzień ↔ styczeń).

### Integration Tests:

- pgTAP z fazy 1 (izolacja gospodarstw, blokada kolumn wpisów cyklicznych, usunięcie wpisu bez zatrzymania definicji).
- Smoke z fazy 5 (API historii, edycja/usunięcie, reguły wpisów cyklicznych, render strony).

### Manual Testing Steps:

1. Dodaj wydatek i przychód, otwórz `/history`, edytuj kwotę, zmień kategorię wydatku, usuń wpis.
2. Zarchiwizuj kategorię i sprawdź pigułkę oraz edycję wpisu w tej kategorii.
3. Utwórz cykl, zmień kwotę przyszłego wpisu w historii, potem zmień kwotę cyklu i sprawdź podpowiedź oraz to, że wpis wrócił do kwoty definicji.
4. Przejdź strzałkami na `/history` do miesiąca przyszłego i przeszłego (także przez granicę roku); z `/dashboard` wejdź w historię przez tytuł.

## Performance Considerations

Lista jest ograniczona do jednego miesiąca i 200 wierszy na rodzaj (limit CPU 10 ms w planie Cloudflare, `infrastructure.md:66-68`), a zakres dat korzysta z indeksów `(household_id, spent_on|received_on)`. `GET /api/history` robi do czterech odczytów (wpisy, kategorie, suma, bez przypomnień); wydajność sprawdzić ręcznie na realnym miesiącu.

## Migration Notes

Migracja jest addytywna (trigger, nowe polityki, zastąpienie dwóch wąskich polityk DELETE szerszymi) i nie zmienia istniejących danych ani kolumn. Wycofanie: odwrotna migracja (usunięcie triggerów i nowych polityk, przywrócenie starych polityk DELETE).

## References

- Related research: `context/changes/expense-history-and-edits/research.md`
- Wzorzec tras `[id]`: `src/pages/api/categories/[id].ts:18-51`
- Wzorzec potwierdzenia usunięcia: `src/components/settings/CategoryManager.tsx:25-71`
- Wzorzec zakładek SSR: `src/pages/settings/recurring.astro:44-58`
- RPC cykliczne: `supabase/migrations/20261011130000_recurring_expenses.sql:143-233`, `20261012100000_recurring_incomes.sql:103-193`
- Lekcje: `context/foundation/lessons.md`

## Progress

> Convention: `- [ ]` pending, `- [x]` done. Append ` — <commit sha>` when a step lands. Do not rename step titles. See `references/progress-format.md`.

### Phase 1: Baza danych i testy pgTAP

#### Automated

- [x] 1.1 Migracja stosuje się czysto: `npx supabase db reset` — 3565473
- [x] 1.2 Testy pgTAP przechodzą: `npx supabase test db` — 3565473

#### Manual

- [x] 1.3 W Supabase Studio: UPDATE kwoty wygenerowanego wpisu przechodzi, a UPDATE jego daty kończy się błędem `22023` — 3565473

### Phase 2: Warstwa serwerowa (serwis, trasy, typy)

#### Automated

- [x] 2.1 Linting przechodzi: `npm run lint`
- [x] 2.2 Sprawdzenie typów przechodzi: `npx astro check`
- [x] 2.3 Build przechodzi: `npm run build`

#### Manual

- [x] 2.4 Zalogowany użytkownik otwiera `/api/history?typ=wydatki&month=2026-10` i dostaje JSON z wpisami oraz sumami miesiąca

### Phase 3: Nawigacja i strona historii (SSR, odczyt)

#### Automated

- [ ] 3.1 Linting przechodzi: `npm run lint`
- [ ] 3.2 Sprawdzenie typów przechodzi: `npx astro check`
- [ ] 3.3 Build przechodzi: `npm run build`

#### Manual

- [ ] 3.4 Strzałki zmieniają miesiąc na `/history` (także na przyszłe miesiące i przez granicę roku), a tytuł na `/dashboard` prowadzi do historii bieżącego miesiąca
- [ ] 3.5 Filtr kategorii zawęża wydatki; zarchiwizowana kategoria jest oznaczona; wpisy cykliczne w przyszłości mają „zaplanowany”
- [ ] 3.6 Widok jest czytelny na telefonie bez poziomego przewijania

### Phase 4: Edycja i usuwanie w UI

#### Automated

- [ ] 4.1 Linting przechodzi: `npm run lint`
- [ ] 4.2 Sprawdzenie typów przechodzi: `npx astro check`
- [ ] 4.3 Build przechodzi: `npm run build`

#### Manual

- [ ] 4.4 Edycja kwoty/daty/kategorii ręcznego wydatku i kwoty/źródła przychodu odświeża listę i sumy miesiąca
- [ ] 4.5 Wpis cykliczny pozwala zmienić tylko kwotę i opis; data i kategoria są tylko do odczytu
- [ ] 4.6 Usunięcie pojedynczego wpisu cyklicznego nie zatrzymuje definicji (kolejne wpisy dalej istnieją)
- [ ] 4.7 Edycja wpisu w zarchiwizowanej kategorii nie wymusza zmiany kategorii; wybór innej zarchiwizowanej jest odrzucony
- [ ] 4.8 Dodawanie wydatku z ekranu miesiąca działa jak wcześniej (reset i fokus po zapisie)

### Phase 5: Podpowiedź w menedżerach cykli, smoke i domknięcie

#### Automated

- [ ] 5.1 Linting przechodzi: `npm run lint`
- [ ] 5.2 Sprawdzenie typów przechodzi: `npx astro check`
- [ ] 5.3 Build przechodzi: `npm run build`
- [ ] 5.4 Testy pgTAP przechodzą: `npx supabase test db`
- [ ] 5.5 Smoke przechodzi na działającym serwerze: `npm run smoke`

#### Manual

- [ ] 5.6 W edycji kwoty cyklu (wydatki i przychody) widać „Zmiana kwoty cyklu nadpisze przyszłe wpisy.”; po zmianie kwoty przyszłe wpisy, także poprawione ręcznie, mają kwotę definicji
- [ ] 5.7 Cały przepływ działa na telefonie (dodanie, historia, edycja, usunięcie)
