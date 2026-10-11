# Cykliczne wydatki (S-04) Implementation Plan

## Overview

Użytkownik definiuje cykliczny wydatek (kwota, kategoria, dzień miesiąca, horyzont w miesiącach, domyślnie 12). Aplikacja od razu tworzy prawdziwe wpisy `expenses`, po jednym na miesiąc, od miesiąca utworzenia. Kwotę można zmienić (usuń przyszłe wpisy i wygeneruj od nowa), horyzont przedłużyć, a definicję zatrzymać (usuń przyszłe wpisy). Gdy po bieżącym miesiącu zostaje mniej niż 2 miesiące horyzontu, ekran miesiąca pokazuje baner z akcjami „Przedłuż" i „Nie przypominaj". Bez schedulera: wszystko materializuje się w momencie akcji użytkownika (FR-014, FR-015, blok Socrates z `prd.md:95-96`).

## Current State Analysis

- Nic w repo nie przewiduje cykliczności: brak tabeli definicji, brak kolumny łączącej `expenses` z definicją, brak typów (`research.md`, Summary p.1). Zarezerwowana jest tylko nazwa `recurring_definitions` w planie household-foundation; ten plan jej nie używa (tabela nazywa się `recurring_expenses`, bo S-05 dostanie bliźniaczą `recurring_incomes`).
- `expenses` ma polityki tylko SELECT i INSERT (`supabase/migrations/20261008233243_first_expense_and_income.sql:3,50-56`). Test `supabase/tests/database/expenses_income.test.sql:101-104` zakłada, że UPDATE i DELETE dotykają 0 wierszy (obecny fixture ma wyłącznie wpisy ręczne).
- `expenses`: `amount_minor bigint` (grosze, 1..9999999999), `spent_on date`, złożony FK `(household_id, category_id)` bez `ON DELETE` (`:16-27`). Kategorię z wpisami można tylko archiwizować (`categories.archived_at`, `20261009100000_category_management.sql:5`).
- `dateField` odrzuca przyszłe daty w API (`src/lib/validation.ts:19-22`), baza nie ma checku na `spent_on`; wpisy generowane przez funkcje SQL tego walidatora nie przechodzą.
- Wzorzec atomowego zapisu wielu wierszy: funkcja SQL przez `supabase.rpc` (`reorder_categories`, `20261009100000_category_management.sql:44-70`), SECURITY INVOKER, `set search_path = ''`, `revoke … from public, anon; grant … to authenticated`.
- Strefa: Workers działają w UTC, „dziś" i miesiąc liczone są w Europe/Warsaw (`src/lib/dates.ts`). Brak helpera dodawania miesięcy.
- Najbliższy wzorzec ekranu zarządzania: `CategoryManager.tsx` + `useCategoryActions.ts` + `src/pages/api/categories/*` + `src/lib/services/categories.ts` + `src/lib/category-http.ts` (każda mutacja zwraca świeżą listę; 409/`null` → `window.location.reload()`).
- `/settings/*` jest już w `PROTECTED_ROUTES` (`src/middleware.ts:4`); `/api/*` nie, więc każdy endpoint sam sprawdza `locals.user`.
- Job `deploy` w CI nie stosuje migracji; `npx supabase db push` trzeba wykonać przed merge.

## Desired End State

Użytkownik wchodzi w Ustawienia → „Cykliczne wydatki", dodaje definicję (np. Czynsz, 1 850,00 zł, dzień 10., 12 miesięcy) i od razu widzi ją na liście, a „Zostaje" bieżącego miesiąca uwzględnia wpis z tego miesiąca. Może zmienić kwotę, przedłużyć, zatrzymać. Gdy zbliża się koniec horyzontu, na ekranie miesiąca pojawia się zamykalny baner. Weryfikacja: pgTAP dla funkcji SQL, `npm run smoke` dla endpointów i renderowania, ręczne przejście na telefonie.

### Key Discoveries:

- Brak UPDATE/DELETE na `expenses` blokuje FR-015; wąska polityka DELETE (tylko wpisy z `recurring_expense_id`) odblokowuje go bez wchodzenia w zakres S-06 i nie psuje istniejącej asercji pgTAP (`expenses_income.test.sql:101-104`).
- Funkcja SECURITY INVOKER nie może wołać pomocnika, któremu odebrano EXECUTE roli `authenticated`; pomocniki wołane z funkcji użytkownika muszą mieć `grant execute … to authenticated` (zmienia to regułę „funkcje wewnętrzne tracą EXECUTE" z `first-expense-and-income/plan.md:17`, która dotyczy funkcji DEFINER).
- „Dziś" w bazie: `now() at time zone 'Europe/Warsaw'` daje to samo, co `todayInWarsaw()`; liczenie w SQL daje jedno źródło prawdy dla generowania, „przyszłych" wpisów i banera.
- 24 wiersze w jednym wywołaniu RPC to jedno podzapytanie z Workera zamiast 24 sekwencyjnych insertów (mitygacja z `infrastructure.md:66,96`).

## What We're NOT Doing

- Cykliczne przychody (S-05) i ekran historii z edycją/usuwaniem pojedynczych wpisów (S-06). Schemat jest jednak tak zbudowany, żeby S-05 był bliźniaczą kopią (osobna tabela + kolumna w `incomes`).
- Edycja kategorii, dnia miesiąca czy horyzontu istniejącej definicji (FR-015 mówi tylko o kwocie; zmiana reszty = zatrzymaj i utwórz nową). Przedłużenie to jedyna zmiana horyzontu.
- Wyświetlanie zatrzymanych definicji i ich przywracanie: zatrzymanie to miękkie usunięcie (`stopped_at`), definicja znika z listy.
- Przeliczenie wpisu z datą dzisiejszą lub wcześniejszą przy edycji kwoty (zostaje przy starej kwocie; poprawia go S-06).
- Blokada tworzenia definicji dla zarchiwizowanej kategorii po stronie API/SQL (spójnie z `POST /api/expenses`, `category-management/plan.md:36`); formularz oferuje tylko aktywne kategorie.
- Limit liczby definicji na gospodarstwo oraz utwardzanie kolumn przed bezpośrednim PATCH-em przez PostgREST (użytkownik może zmienić własne dane; tak samo jak w `categories`).
- Zmiany w `EntrySheet.tsx` (szybka ścieżka dodawania wydatku zostaje nietknięta).
- Powiadomienia poza ekranem miesiąca (e-mail, push) oraz scheduler/cron.

## Implementation Approach

Bottom-up jak w poprzednich slice'ach: SQL + pgTAP, potem API/serwis, strona zarządzania, na końcu baner, smoke i domknięcie. Cała logika biznesowa siedzi w funkcjach SQL wołanych przez `rpc`, więc każda operacja jest jedną transakcją i jednym podzapytaniem z Workera.

**Model.** `recurring_expenses`: `id`, `household_id` (default `current_household_id()`), `category_id`, `amount_minor`, `day_of_month` (1–31), `start_month` (pierwszy dzień miesiąca utworzenia, Warszawa), `end_month` (pierwszy dzień miesiąca ostatniego slotu), `stopped_at`, `reminder_dismissed_at`, `created_at`. Slot to miesiąc od `start_month` do `end_month`; data wpisu = `day_of_month` przycięty do długości miesiąca, liczony od bazy każdego miesiąca osobno (bez dryfu 31 → 28 → 28). `expenses.recurring_expense_id` (nullable) wskazuje definicję przez złożony FK `(household_id, recurring_expense_id)`.

**Reguły (zatwierdzone w wywiadzie).**
- Pierwszy wpis w miesiącu utworzenia na wybrany dzień, także gdy ten dzień już minął (reguła „od miesiąca utworzenia, nigdy wcześniej" z FR-014) i także gdy jest późniejszy niż dziś (wtedy liczy się od razu do „Zostaje").
- „Przyszłe" wpisy = `spent_on` późniejsze niż dziś w Warszawie. Zatrzymanie usuwa je; edycja kwoty usuwa je i wstawia ponownie sloty z datą późniejszą niż dziś, już z nową kwotą; wpisy z datą ≤ dziś zostają.
- Przedłużenie o N (1–24): nowe sloty zaczynają się od `max(end_month + 1 miesiąc, bieżący miesiąc)`, a `end_month` przesuwa się na ostatni nowy slot (przedłużenie wygasłej definicji zaczyna od bieżącego miesiąca, nie tworzy przeszłych wpisów) i zeruje `reminder_dismissed_at`. Limit „do 24" oznacza, że horyzont obejmuje najwyżej 24 miesiące licząc od bieżącego włącznie (`months_left` ≤ 23): przedłużenie, po którym `months_left` byłoby większe niż 23, kończy się błędem `22023`. Definicję można więc przedłużać bez końca (czynsz), ale wpisów w przyszłości jest zawsze najwyżej 24, a edycja kwoty regeneruje ich najwyżej tyle samo. To wariant C z triage przeglądu planu (F4), zaostrzony w fazie 3: pierwotnie było 24 miesiące po bieżącym (`months_left` ≤ 24), co przy przedłużeniu dawało 25 wpisów, a przy tworzeniu 24; ta sama reguła obejmuje teraz tworzenie (`p_months` 1..24) i przedłużanie.
- `months_left` = liczba miesięcy między bieżącym miesiącem a `end_month`. Przypomnienie (`remind`): definicja niezatrzymana, `0 ≤ months_left ≤ 1` i `reminder_dismissed_at is null`. Przykład: 12 slotów od października 2026 kończy się we wrześniu 2027; w lipcu `months_left` = 2 (brak banera), w sierpniu 1 (baner), we wrześniu 0 (baner), w październiku −1 (wygasła, bez banera, nadal przedłużalna na liście).
- Lista pokazuje definicje niezatrzymane (aktywne i wygasłe).

**Funkcje SQL (wszystkie SECURITY INVOKER, `set search_path = ''`, `revoke … from public, anon; grant … to authenticated`):** `create_recurring_expense`, `update_recurring_expense_amount`, `extend_recurring_expense`, `stop_recurring_expense`, `dismiss_recurring_reminder`, `list_recurring_expenses` oraz czyste pomocniki `warsaw_today()`, `recurring_slot_date(month, day)` i `recurring_month_diff(from, to)`. Operacje na istniejącej definicji blokują jej wiersz (`for update`) i zgłaszają `P0002`, gdy definicja nie istnieje, nie należy do gospodarstwa lub jest zatrzymana.

## Critical Implementation Details

- **Uprawnienia pomocników.** Funkcje INVOKER wołają pomocników z uprawnieniami wywołującego, więc `recurring_slot_date`, `recurring_month_diff` i `warsaw_today` muszą mieć `grant execute … to authenticated` (są czyste i niczego nie czytają).
- **Atomowość i współbieżność.** Usuń + wstaw dzieje się w jednej funkcji (jedna transakcja); `select … for update` na wierszu definicji serializuje równoległą edycję/przedłużenie (dwa kliknięcia, dwie karty), żeby nie powstały zdublowane sloty.
- **Test zegara.** Funkcje publiczne nie przyjmują parametru „dziś" (nie da się cofnąć daty przez `rpc`); logikę dat testuj na czystych pomocnikach ze stałymi datami (m.in. luty roku przestępnego, dzień 31), a scenariusze create/edit/stop asercjami względnymi do `warsaw_today()` i ręcznie wstawionymi wpisami z przeszłą datą.

## Phase 1: Baza danych i testy pgTAP

### Overview

Nowa migracja z tabelą definicji, kolumną łączącą, politykami RLS i funkcjami SQL oraz nowy plik pgTAP. Po tej fazie cała logika FR-014/FR-015 działa w bazie i jest przetestowana bez UI.

### Changes Required:

#### 1. Migracja schematu

**File**: `supabase/migrations/<timestamp>_recurring_expenses.sql` (format `YYYYMMDDHHmmss`, data późniejsza niż `20261009100000`)

**Intent**: Tworzy `recurring_expenses` (kolumny z sekcji Implementation Approach, CHECK: `amount_minor` jak w `expenses`, `day_of_month` 1..31, `start_month` i `end_month` to pierwsze dni miesięcy, `end_month >= start_month`), dodaje `expenses.recurring_expense_id` z indeksem częściowym `(recurring_expense_id, spent_on)` i włącza RLS.

**Contract**: `unique (household_id, id)` na definicji jako cel złożonego FK; złożone FK `(household_id, category_id) → categories(household_id, id)` oraz `(household_id, recurring_expense_id) → recurring_expenses(household_id, id)` (bez `ON DELETE`: definicje nie są usuwane, tylko zatrzymywane). Polityki dla roli `authenticated`, wszystkie z `household_id = (select public.current_household_id())` (lekcja `lessons.md:5-10`): `recurring_expenses` SELECT / INSERT (WITH CHECK) / UPDATE (USING + WITH CHECK), bez DELETE; `expenses` dodatkowo DELETE ograniczony do `recurring_expense_id is not null`. Częściowy indeks unikalny `(household_id, category_id, amount_minor, day_of_month, start_month) where stopped_at is null` odrzuca (`23505`) drugą identyczną aktywną definicję z tego samego miesiąca (ochrona przed podwójnym wywołaniem tworzenia; lekcja w `lessons.md`). Komentarz nagłówkowy migracji zaktualizować, żeby opisywał zawężony DELETE zamiast „insert-only until S-06".

#### 2. Funkcje SQL

**File**: ta sama migracja

**Intent**: Zamyka wszystkie operacje FR-014/FR-015 plus przedłużenie i ukrycie przypomnienia w funkcjach `rpc`, tak by Worker robił jedno podzapytanie na akcję.

**Contract**:
- `create_recurring_expense(p_category_id uuid, p_amount_minor bigint, p_day int, p_months int)` → wstawia definicję (`start_month` = bieżący miesiąc Warszawy, `end_month` = `start_month + (p_months-1)`) i wszystkie sloty; `p_months` poza 1..24 → `22023`.
- `update_recurring_expense_amount(p_id uuid, p_amount_minor bigint)`, `extend_recurring_expense(p_id uuid, p_months int)` (poza 1..24 oraz gdy po operacji `months_left` > 23 → `22023`), `stop_recurring_expense(p_id uuid)`, `dismiss_recurring_reminder(p_id uuid)` według reguł z Implementation Approach.
- `list_recurring_expenses()` → wiersze: `id, category_id, category_name, category_archived, amount_minor, day_of_month, start_month, end_month, months_left, remind` dla definicji niezatrzymanych, `order by created_at desc, id` (najnowsze na górze, stabilna kolejność przy remisie).
- `warsaw_today()` (stable) i `recurring_slot_date(p_month date, p_day int)` (immutable; przycina dzień do ostatniego dnia miesiąca, każdy miesiąc liczony od bazy) oraz `recurring_month_diff(p_from date, p_to date)` (immutable; liczba pełnych miesięcy kalendarzowych między miesiącami dwóch dat, ujemna gdy `p_to` jest wcześniejsza; jedno miejsce na arytmetykę miesięcy dla update, extend i list).

#### 3. Testy pgTAP

**File**: `supabase/tests/database/recurring_expenses.test.sql` (nowy plik; istniejące pliki bez zmian, zgodnie z precedensem `category-management/plan.md:15`)

**Intent**: Pilnuje reguł dat, izolacji gospodarstw i granicy „przyszłe vs przeszłe" według wzorca istniejących testów (dwóch użytkowników, przełączanie roli, `throws_ok` z kodami).

**Contract**: Pokryć co najmniej: `recurring_slot_date` (dzień 31 → 31 sty / 28 lut / 31 mar, luty roku przestępnego 29, dzień 30 w lutym); `create` tworzy dokładnie `p_months` wierszy z `recurring_expense_id`, pierwszy w bieżącym miesiącu Warszawy; walidacje (miesiące 0 i 25, kwota ≤ 0, cudza kategoria `23503`); `stop` usuwa tylko wpisy z datą późniejszą niż dziś i nie rusza ręcznie wstawionego wpisu generowanego z przeszłą datą ani wpisów ręcznych; `update_amount` zmienia kwotę przyszłych wpisów i ich liczba się nie zmienia; `extend` dopisuje sloty za `end_month`, a dla wygasłej definicji zaczyna od bieżącego miesiąca; przedłużenie dokładnie do limitu (24 miesiące łącznie z bieżącym) przechodzi, a o jeden miesiąc dalej → `22023`; `dismiss` ustawia znacznik, a `extend` go zeruje; `list` oblicza `months_left`/`remind` dla definicji kończącej się w bieżącym i następnym miesiącu, a dla definicji kończącej się za 2 miesiące zwraca `remind = false`; izolacja (użytkownik B nie widzi ani nie modyfikuje definicji A → `P0002`/0 wierszy); druga identyczna aktywna definicja → `23505`, a po zatrzymaniu pierwszej identyczna jest dozwolona; użytkownik `anon` bez dostępu; bezpośredni DELETE wpisu ręcznego nadal dotyka 0 wierszy. Uaktualnić `plan(N)`.

### Success Criteria:

#### Automated Verification:

- Migracja stosuje się na czysto: `npx supabase db reset`
- Wszystkie testy pgTAP przechodzą, w tym nowy plik, a istniejące pliki bez edycji: `npx supabase test db`

#### Manual Verification:

- W Studio `select create_recurring_expense(...)` z dniem 31 i 3 miesiącami daje wiersze w `expenses` z poprawnie przyciętymi datami i wypełnionym `recurring_expense_id`
- `list_recurring_expenses()` pokazuje `months_left` i `remind` zgodne z przykładem z sekcji Implementation Approach

**Implementation Note**: Po zakończeniu tej fazy i przejściu automatycznych kontroli zatrzymaj się na ręczne potwierdzenie przed następną fazą. Pola wyboru dla tych punktów są w sekcji `## Progress` na dole planu.

---

## Phase 2: API, serwis i typy

### Overview

Cienkie endpointy nad funkcjami SQL, serwis, typy i mapowanie błędów. Po tej fazie całą funkcję można wywołać przez HTTP, bez UI.

### Changes Required:

#### 1. Typy i walidacja

**File**: `src/types.ts`, `src/lib/validation.ts`, `src/lib/http.ts`

**Intent**: Dodaje typy odpowiedzi i schematy zod dla nowych endpointów, ponownie używając `amountField`; rozszerza typowaną unię `json()` o nową odpowiedź.

**Contract**: `RecurringExpense` (`id, categoryId, categoryName, categoryArchived, amountMinor, dayOfMonth, startMonth, endMonth, monthsLeft, remind`) i `RecurringListResponse {items: RecurringExpense[]}` w `src/types.ts`; pola wejściowe: `categoryId` (`z.uuid`), `amount` (`amountField`), `dayOfMonth` (int 1..31), `months` (int 1..24, domyślnie 12 w formularzu). Brak `dateField`: daty wpisów liczy baza.

#### 2. Serwis

**File**: `src/lib/services/recurring-expenses.ts`

**Intent**: Opakowuje `supabase.rpc` dla każdej operacji i zwraca `{ok, items | null}` albo `{ok:false, code}` na wzór `src/lib/services/categories.ts`; wiersze walidowane schematem zod jak `categoryRows`.

**Contract**: `listRecurringExpenses`, `createRecurringExpense`, `updateRecurringAmount`, `extendRecurring`, `stopRecurring`, `dismissReminder`; każda mutacja zwraca świeżą listę (`null`, gdy odczyt po zapisie się nie powiódł).

#### 3. Endpointy

**File**: `src/pages/api/recurring-expenses/index.ts` (POST) oraz `src/pages/api/recurring-expenses/[id].ts` (PATCH, DELETE)

**Intent**: Wzorzec `categories/*`: `prerender = false`, 401 bez `locals.user`, `createClient`, `readJson`, `safeParse`, odpowiedź ze świeżą listą. PATCH przyjmuje dokładnie jedno z: `{amount}`, `{extendMonths}`, `{dismissReminder: true}`; DELETE zatrzymuje definicję.

**Contract**: Mapowanie kodów w jednym miejscu (na wzór `src/lib/category-http.ts`): `23503` → 400 „Wybierz kategorię z listy", `22023` → 400 z komunikatem walidacyjnym (dla przekroczenia horyzontu: „Horyzont może obejmować najwyżej 24 miesiące (licząc od bieżącego)"), `23505` → 400 „Taka cykliczna pozycja już istnieje" (tworzenie i zmiana kwoty), `P0002` → 404, inne → 500 `SAVE_FAILED`. `[id]` walidowane `z.uuid()`.

### Success Criteria:

#### Automated Verification:

- Linting przechodzi: `npm run lint`
- Sprawdzanie typów przechodzi: `npx astro check`
- Build przechodzi: `npm run build`

#### Manual Verification:

- Zalogowany `fetch` z konsoli przeglądarki: POST tworzy definicję i zwraca listę; PATCH z `amount`, `extendMonths` i `dismissReminder` zwraca zaktualizowaną listę; DELETE zwraca listę bez definicji
- Anonimowe wywołanie daje 401, błędne dane (dzień 32, 0 miesięcy, kwota 0) dają 400, nieznane `id` daje 404

**Implementation Note**: Po zakończeniu tej fazy i przejściu automatycznych kontroli zatrzymaj się na ręczne potwierdzenie przed następną fazą.

---

## Phase 3: Strona zarządzania `/settings/recurring`

### Overview

Ekran listy, dodawania, edycji kwoty, przedłużenia i zatrzymania. Po tej fazie użytkownik obsługuje całe FR-014/FR-015 z przeglądarki.

### Changes Required:

#### 1. Strona i nawigacja

**File**: `src/pages/settings/recurring.astro`, `src/components/Topbar.astro`

**Intent**: Strona ładuje listę serwerowo (z takim samym czerwonym `role="alert"` przy błędzie jak `categories.astro`) i aktywne kategorie dla formularza; w menu „Ustawienia" pojawia się druga pozycja „Cykliczne wydatki". `/settings/*` jest już chronione, więc `PROTECTED_ROUTES` bez zmian.

**Contract**: Komponent wyspowy `client:load` z propsami: lista definicji i lista aktywnych kategorii (`{id, name}`).

#### 2. Komponent i hook

**File**: `src/components/settings/RecurringManager.tsx`, `src/hooks/useRecurringActions.ts`

**Intent**: Formularz dodawania (kwota, kategoria, dzień miesiąca, liczba miesięcy z domyślnym 12; przycisk „Dodaj" wyłączony na czas żądania dzięki stanowi `pending`, jako ochrona przed podwójnym submitem) i lista wierszy z inline edycją kwoty, akcją „Przedłuż" o `min(12, 23 − monthsLeft)` mies. (nieaktywna z podpowiedzią, gdy `monthsLeft` ≥ 23), zatrzymaniem z potwierdzeniem w miejscu („Na pewno? Wygenerowane przyszłe wpisy zostaną usunięte", jak `DeleteControl`) i oznaczeniem statusu „Wygasła". Hook kopiuje wzorzec `useCategoryActions` (świeża lista po każdej mutacji, reload przy 409/`null`).

**Contract**: Wiersz pokazuje kategorię (z dopiskiem „zarchiwizowana", gdy `categoryArchived`), kwotę (`formatMinor`), dzień miesiąca i zakres „od–do" z `startMonth`/`endMonth` (`formatMonthLabel`). Cele dotykowe `min-h-11`, pola jak istniejący `fieldClass`, bez nowych komponentów shadcn. Komunikaty po polsku, błędy per wiersz przez `ServerError`.

### Success Criteria:

#### Automated Verification:

- Linting przechodzi: `npm run lint`
- Sprawdzanie typów przechodzi: `npx astro check`
- Build przechodzi: `npm run build`

#### Manual Verification:

- Na szerokości telefonu: utworzenie definicji (dzień 10., 3 miesiące) pokazuje ją na liście, a „Zostaje" na `/dashboard` uwzględnia wpis z bieżącego miesiąca
- Edycja kwoty zmienia przyszłe wpisy, ale nie wpis z datą ≤ dziś; zatrzymanie z potwierdzeniem usuwa definicję z listy
- „Przedłuż" dopisuje miesiące; kategoria zarchiwizowana po utworzeniu definicji jest oznaczona na liście
- Po przebudowie (`build`/`astro check`) serwer dev trzeba zrestartować i odświeżyć stronę twardo, bo wyspy przestają się hydratować

**Implementation Note**: Po zakończeniu tej fazy i przejściu automatycznych kontroli zatrzymaj się na ręczne potwierdzenie przed następną fazą.

---

## Phase 4: Baner na ekranie miesiąca, smoke i domknięcie

### Overview

Przypomnienie o kończącym się horyzoncie, krok w smoke teście oraz pomiar CPU i wdrożenie migracji na produkcję.

### Changes Required:

#### 1. Baner

**File**: `src/pages/dashboard.astro`, `src/components/month/MonthScreen.tsx`, nowy `src/components/month/RecurringReminders.tsx`

**Intent**: `dashboard.astro` pobiera pełną listę definicji i przekazuje ją jako prop; błąd odczytu traktuje jako pustą listę, żeby nie psuć ekranu miesiąca. Baner (między `<h1>` a sumami) pokazuje wyłącznie wiersze z `remind = true`, filtrowane po każdej odpowiedzi hooka (hook `useRecurringActions` podmienia cały stan świeżą listą jak `useCategoryActions`, więc po „Nie przypominaj" lub „Przedłuż" wiersz z `remind = false` sam znika z banera). Wiersz banera opisuje definicję kategorią, kwotą i dniem miesiąca, bo definicja nie ma własnej nazwy („Dom i rachunki, 1 850,00 zł, dzień 10: kończy się za 1 mies."), z przyciskami „Przedłuż o 12 mies." (baner pokazuje się przy `monthsLeft` ≤ 1, więc 12 zawsze mieści się w limicie 24) i „Nie przypominaj".

**Contract**: Prop `recurring: RecurringExpense[]` (pełna lista) w `MonthScreen`; dla `monthsLeft === 0` tekst „kończy się w tym miesiącu". Atrybuty `data-*` używane przez smoke (`data-category-ids`) pozostają bez zmian.

#### 2. Smoke

**File**: `scripts/smoke.mjs`

**Intent**: Dodaje kroki w trzech miejscach skryptu, bo zalogowane i anonimowe żądania dzielą je wylogowanie (`smoke.mjs:244`). Zmiana bieżącego miesiąca nie może zepsuć asercji `left`, a anonimowy 401 wydatków musi zostać ostatni (`smoke.mjs:266-267`: nieprzeczytane body 401 psuje następne żądanie).

**Contract**:
- Zalogowane, zaraz po asercji `left` przychodu (`smoke.mjs:181-188`) i przed dodaniem „Smoke Zwierzęta", na `categoryId` z dashboardu (kategoria „Smoke Zwierzęta" jest później kasowana, a definicja na jej id zablokowałaby DELETE przez FK): `POST` definicji (dzień 1., 2 miesiące) → 200 i lista zawiera pozycję; `PATCH` kwoty → 200; `GET /settings/recurring` bez `[object Object]`; `DELETE` → lista bez pozycji.
- Po wylogowaniu, obok kroku `/settings/categories` (`smoke.mjs:246-250`): `GET /settings/recurring` → 302 na `/auth/signin`.
- Anonimowy test 401 API: `DELETE /api/recurring-expenses/<dowolne uuid>` → 401. DELETE nie ma body, więc nie psuje następnego żądania; anonimowy POST ze zbędnym body odpada.

#### 3. Domknięcie

**File**: `context/foundation/roadmap.md`, `context/changes/recurring-expenses/change.md`

**Intent**: Status S-04 przechodzi przez `planning` → `in-progress` → `done` zgodnie ze skillami `/10x-implement` i `/10x-archive`; poprawić nieaktualny wiersz handoff „Blocked on S-01" (`roadmap.md:179`).

**Contract**: Tylko pola statusu i ten wiersz; zmiany w `CLAUDE.md` nie są wymagane.

### Success Criteria:

#### Automated Verification:

- Linting przechodzi: `npm run lint`
- Sprawdzanie typów przechodzi: `npx astro check`
- Build przechodzi: `npm run build`
- Testy pgTAP przechodzą: `npx supabase test db`
- Smoke przechodzi na buildzie produkcyjnym z lokalnym Supabase: `npm run smoke`

#### Manual Verification:

- Definicja z 2 miesiącami (kończy się w następnym miesiącu) pokazuje baner od razu; „Nie przypominaj" ukrywa go po przeładowaniu i na innym urządzeniu; „Przedłuż" go usuwa, a definicja na liście ma nowy zakres
- Migracja zastosowana na produkcji przed merge: `npx supabase db push` (job deploy jej nie stosuje)
- Na produkcji definicja z 24 miesiącami, potem edycja kwoty: czas CPU wywołań sprawdzony w panelu Cloudflare lub `npx wrangler tail` i mieści się w limicie 10 ms; wynik odnotowany w planie (mitygacja z `infrastructure.md:96`)

**Implementation Note**: Po tej fazie plan jest zakończony; zamknięcie zmiany (`/10x-archive`) dopiero po potwierdzeniu produkcji.

---

## Testing Strategy

### Unit Tests:

- Brak runnera JS w repo (`first-expense-and-income/plan.md:47,304`), więc logika dat jest testowana w pgTAP (Phase 1) na czystych funkcjach SQL.
- Przypadki brzegowe: dzień 29–31 w krótkich miesiącach i w roku przestępnym, granica „data ≤ dziś" przy zatrzymaniu i edycji, przedłużenie wygasłej definicji, granica 24 miesięcy łącznie z bieżącym przy przedłużeniu, ukryte przypomnienie po przedłużeniu, izolacja gospodarstw.

### Integration Tests:

- `scripts/smoke.mjs`: pełny cykl create → patch → delete przez HTTP oraz renderowanie `/settings/recurring`.

### Manual Testing Steps:

1. Dodaj definicję z dniem późniejszym niż dziś i sprawdź, że wpis wchodzi do „Zostaje" bieżącego miesiąca.
2. Dodaj z dniem 31 i sprawdź przycięcie w krótszych miesiącach (przez Studio lub, po S-06, w historii).
3. Zmień kwotę w połowie miesiąca i sprawdź, że wpis z datą ≤ dziś zostaje przy starej kwocie.
4. Zarchiwizuj kategorię definicji i sprawdź oznaczenie na liście.

## Performance Considerations

Każda akcja to jedno wywołanie RPC (≤ 24 wiersze przy tworzeniu i przedłużaniu, a przy edycji kwoty najwyżej 24 usunięte i 24 wstawione, bo horyzont obejmuje najwyżej 24 miesiące), co odpowiada mitygacji „zbatchuj inserty" z `infrastructure.md:96`. Brak instrumentacji CPU w repo; pomiar odbywa się ręcznie w Phase 4. Indeks częściowy `(recurring_expense_id, spent_on)` obsługuje usuwanie przyszłych wpisów.

## Migration Notes

Migracja jest addytywna (nowa tabela, nowa nullable kolumna, nowe polityki) i nie zmienia istniejących wierszy. Przed merge: `npx supabase db push` na produkcję (job `deploy` migracji nie stosuje, `category-management/plan.md:205,232`); wycofanie to nowa migracja usuwająca funkcje i politykę DELETE, bo istniejące wpisy generowane pozostają poprawnymi wpisami. Workflow git: kod idzie przez branch i PR, nie bezpośrednio na master.

## References

- Related research: `context/changes/recurring-expenses/research.md`
- PRD: `context/foundation/prd.md:92-97` (FR-014/FR-015, Socrates), `:110` (FR-019)
- Roadmap: `context/foundation/roadmap.md:132-143` (S-04), `:145-156` (S-05)
- Wzorzec RPC: `supabase/migrations/20261009100000_category_management.sql:44-70`
- Wzorzec zarządzania: `src/components/settings/CategoryManager.tsx`, `src/hooks/useCategoryActions.ts`, `src/pages/api/categories/`
- Ryzyko CPU: `context/foundation/infrastructure.md:66,96`
- Lekcja RLS: `context/foundation/lessons.md:5-10`

## Progress

> Convention: `- [ ]` pending, `- [x]` done. Append ` — <commit sha>` when a step lands. Do not rename step titles. See `references/progress-format.md`.

### Phase 1: Baza danych i testy pgTAP

#### Automated

- [x] 1.1 Migracja stosuje się na czysto: `npx supabase db reset` — f60dd04
- [x] 1.2 Wszystkie testy pgTAP przechodzą, w tym nowy plik, a istniejące pliki bez edycji: `npx supabase test db` — f60dd04

#### Manual

- [x] 1.3 W Studio `select create_recurring_expense(...)` z dniem 31 i 3 miesiącami daje wiersze w `expenses` z poprawnie przyciętymi datami i wypełnionym `recurring_expense_id` — f60dd04
- [x] 1.4 `list_recurring_expenses()` pokazuje `months_left` i `remind` zgodne z przykładem z sekcji Implementation Approach — f60dd04

### Phase 2: API, serwis i typy

#### Automated

- [x] 2.1 Linting przechodzi: `npm run lint` — e71049c
- [x] 2.2 Sprawdzanie typów przechodzi: `npx astro check` — e71049c
- [x] 2.3 Build przechodzi: `npm run build` — e71049c

#### Manual

- [x] 2.4 Zalogowany `fetch` z konsoli przeglądarki: POST tworzy definicję i zwraca listę; PATCH z `amount`, `extendMonths` i `dismissReminder` zwraca zaktualizowaną listę; DELETE zwraca listę bez definicji — e71049c
- [x] 2.5 Anonimowe wywołanie daje 401, błędne dane (dzień 32, 0 miesięcy, kwota 0) dają 400, nieznane `id` daje 404 — e71049c

### Phase 3: Strona zarządzania `/settings/recurring`

#### Automated

- [x] 3.1 Linting przechodzi: `npm run lint`
- [x] 3.2 Sprawdzanie typów przechodzi: `npx astro check`
- [x] 3.3 Build przechodzi: `npm run build`

#### Manual

- [x] 3.4 Na szerokości telefonu: utworzenie definicji (dzień 10., 3 miesiące) pokazuje ją na liście, a „Zostaje" na `/dashboard` uwzględnia wpis z bieżącego miesiąca
- [x] 3.5 Edycja kwoty zmienia przyszłe wpisy, ale nie wpis z datą ≤ dziś; zatrzymanie z potwierdzeniem usuwa definicję z listy
- [x] 3.6 „Przedłuż" dopisuje miesiące; kategoria zarchiwizowana po utworzeniu definicji jest oznaczona na liście
- [x] 3.7 Po przebudowie (`build`/`astro check`) serwer dev trzeba zrestartować i odświeżyć stronę twardo, bo wyspy przestają się hydratować

### Phase 4: Baner na ekranie miesiąca, smoke i domknięcie

#### Automated

- [ ] 4.1 Linting przechodzi: `npm run lint`
- [ ] 4.2 Sprawdzanie typów przechodzi: `npx astro check`
- [ ] 4.3 Build przechodzi: `npm run build`
- [ ] 4.4 Testy pgTAP przechodzą: `npx supabase test db`
- [ ] 4.5 Smoke przechodzi na buildzie produkcyjnym z lokalnym Supabase: `npm run smoke`

#### Manual

- [ ] 4.6 Definicja z 2 miesiącami (kończy się w następnym miesiącu) pokazuje baner od razu; „Nie przypominaj" ukrywa go po przeładowaniu i na innym urządzeniu; „Przedłuż" go usuwa, a definicja na liście ma nowy zakres
- [ ] 4.7 Migracja zastosowana na produkcji przed merge: `npx supabase db push` (job deploy jej nie stosuje)
- [ ] 4.8 Na produkcji definicja z 24 miesiącami, potem edycja kwoty: czas CPU wywołań sprawdzony w panelu Cloudflare lub `npx wrangler tail` i mieści się w limicie 10 ms; wynik odnotowany w planie
