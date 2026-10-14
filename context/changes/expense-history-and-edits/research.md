---
date: 2026-10-12T19:17:53+02:00
researcher: Claude (Sonnet 5.5), na zlecenie Paweł Wojno
git_commit: b0b0205c3e6f35bcdac210d7b708806f40781297
branch: master
repository: Hajsownik
topic: "S-06 expense-history-and-edits: historia wydatków i przychodów (filtr miesiąc/kategoria) oraz edycja/usuwanie wpisów; filtr kategorii obejmie przychody po S-07 (source -> category_id)"
tags: [research, codebase, history, expenses, incomes, rls, recurring, s-07]
status: complete
last_updated: 2026-10-12
last_updated_by: Claude (Sonnet 5.5)
---

# Research: S-06 historia i edycja wpisów

**Date**: 2026-10-12T19:17:53+02:00
**Git Commit**: b0b0205 (stan czysty, bez niezatwierdzonych zmian w momencie startu)
**Branch**: master

## Research Question

Co baza kodu już robi i co trzeba zmienić, żeby dostarczyć S-06: ekran historii wpisów (filtr po miesiącu i kategorii) oraz edycję i usuwanie dowolnego wpisu (ręcznego lub wygenerowanego z definicji cyklicznej), bez zatrzymywania definicji. Założenie od użytkownika: filtr po kategorii obejmie też przychody po S-07, gdy `source` zostanie zastąpione przez `category_id` — więc S-06 ma trzymać `source` w jak najmniejszej liczbie miejsc.

## Summary

- **Brak jakiegokolwiek odczytu listy wpisów.** W `src/` jedyne odwołania do tabel `expenses`/`incomes` to INSERT-y w `src/pages/api/expenses.ts:39` i `src/pages/api/incomes.ts:37`; reszta czyta tylko sumy przez RPC `month_summary` (`src/lib/services/month.ts:9-30`). Lista, filtry i typ wpisu do listy nie istnieją (`src/types.ts` nie ma takiego typu).
- **RLS blokuje edycję i usuwanie ręcznych wpisów.** Na `expenses` i `incomes` są tylko polityki SELECT i INSERT oraz wąskie DELETE tylko dla wierszy z `recurring_*_id is not null` (`20261011130000_recurring_expenses.sql:64-66`, `20261012100000_recurring_incomes.sql:63-65`). Brak jakiejkolwiek polityki UPDATE. Nowa migracja jest więc warunkiem koniecznym (nagłówki obu migracji mówią wprost: „Manual rows stay delete-protected until S-06”).
- **Wygenerowane wpisy da się rozpoznać w danych** (`recurring_expense_id` / `recurring_income_id` != null), ale RPC cykliczne operują na datach, nie na „edytowaniu przez użytkownika” — zmiana kwoty definicji nadpisze ręcznie zmienione przyszłe wpisy (patrz „Interakcja z RPC”). To główny nierozstrzygnięty punkt projektowy.
- **Walidacja daty odrzuca przyszłość** (`dateField`, `src/lib/validation.ts:28-31`), a wygenerowane wpisy mogą być datowane w przyszłości; edycja zapisana przez ten sam schemat odrzuciłaby nawet niezmienioną datę takiego wpisu.
- **Konwencje do skopiowania są jasne:** trasy `[id].ts` z PATCH/DELETE (kategorie, cykliczne), wzorzec serwis → `*-http.ts` → hook z `pending` i błędem per wiersz, dwuetapowe potwierdzenie usunięcia inline (bez `confirm()`), plakietka „zarchiwizowana”, nawigacja filtrów jako linki SSR jak w `settings/recurring.astro`.
- **Dla S-07:** etykieta przychodu (dziś `source`) powinna powstawać w jednym miejscu; kategoria jest już w obu tabelach rozwiązywalna przez `categories` (wydatki: FK kompozytowy; przychody: po S-07 `category_id`). Filtr kategorii ma być więc zbudowany na `category_id` jako parametrze wspólnym dla obu rodzajów wpisów, a dla przychodów aktywowany dopiero po S-07.

## Detailed Findings

### Schemat i indeksy

- `expenses`: `category_id` NOT NULL, `amount_minor` (>0, <=9999999999), `spent_on date`, `description` (<=200, nullable), `recurring_expense_id` nullable. Kompozytowy FK `(household_id, category_id)` bez ON DELETE (NO ACTION) — kategoria z wydatkami nie da się usunąć (`20261008233243_first_expense_and_income.sql:16-29`, `20261011130000_recurring_expenses.sql:40-44`).
- `incomes`: `source text` z checkiem na 5 wartości, `received_on date`, `recurring_income_id` nullable, brak `description` i brak `category_id` (`20261008233243_first_expense_and_income.sql:31-40`, `20261012100000_recurring_incomes.sql:39-43`).
- Indeksy: `(household_id, spent_on)` i `(household_id, received_on)` obsługują filtr miesiąca i sortowanie; brak indeksu po `category_id` (filtr kategorii w skali gospodarstwa domowego prawdopodobnie wystarczy bez niego — wniosek, nie pomiar). Brak unikalnego indeksu `(recurring_*_id, data)`, więc edycja daty wygenerowanego wpisu nie jest blokowana przez bazę.
- `categories.archived_at` to flaga archiwizacji; `listCategories` zwraca wszystkie (aktywne najpierw), `listActiveCategories` tylko aktywne (`src/lib/services/categories.ts:13-37`).

### RLS

- Wszystkie polityki: `to authenticated`, `household_id = (select public.current_household_id())` (zgodne z `context/foundation/lessons.md:5-10`).
- Brakuje: UPDATE na `expenses` i `incomes`; DELETE dla ręcznych wierszy. Najprostsza ścieżka: zastąpić `expenses_delete_generated` / `incomes_delete_generated` jednym DELETE ograniczonym tylko do gospodarstwa (decyzja do planu).
- Test pgTAP `supabase/tests/database/expenses_income.test.sql:100-104` asercją „0 wierszy” potwierdza dziś default-deny dla UPDATE i DELETE ręcznych wierszy; po S-06 te asercje muszą zostać zmienione (sprawdzone: wiersze w teście są ręczne, więc DELETE z S-04 ich nie obejmuje).

### Interakcja z RPC cyklicznymi (sprawdzone w `20261011130000_recurring_expenses.sql:143-174`; analogiczne dla przychodów w `20261012100000_recurring_incomes.sql:103-134`)

- „Przyszły” = `spent_on > warsaw_today()`; wpisy nie mają znacznika „edytowany przez użytkownika”.
- Zmiana kwoty definicji usuwa wszystkie wygenerowane wpisy z datą po dziś i regeneruje sloty z kategorią definicji: ręcznie zmieniona kwota/kategoria/data przyszłego wpisu zostaje nadpisana, a ręcznie usunięty przyszły wpis wraca (potwierdza to `context/archive/2026-10-11-recurring-expenses/plan-brief.md:56`).
- Zatrzymanie definicji usuwa wygenerowane wpisy z datą po dziś; wpis przesunięty ręcznie w przyszłość zostanie usunięty, przesunięty w przeszłość — zostanie.
- Rozszerzenie dopisuje tylko po `end_month`, więc nie wskrzesza usuniętych wpisów.
- Wpisy z datą dziś lub wcześniejszą nie są ruszane przez żadne z tych RPC.
- Brak funkcji zmieniającej kategorię lub dzień definicji.
- Skutek dla FR-019/FR-020: usunięcie lub edycja pojedynczego wygenerowanego wpisu nie zatrzymuje definicji (zgodnie z wymaganiem) — baza tego nie łamie; ale wygenerowane wpisy z przyszłości mają ograniczoną „trwałość” edycji do następnej zmiany kwoty definicji.

### API

- `api/expenses.ts` i `api/incomes.ts` eksportują tylko `POST`; schematy zod `expenseSchema`/`incomeSchema` są lokalne i nie eksportowane (`expenses.ts:13-18`, `incomes.ts:12-16`). `date` jest tam opcjonalna (domyślnie dziś).
- Wzorzec trasy z id: `categories/[id].ts:18-51` (`prerender=false`, `z.uuid()` na parametr, auth, `createClient`, `readJson`, `safeParse`, 400 z `issues[0].message`). Nie znaleziono wiersza → `.update().eq("id").select("id")` i `data.length === 0` → `not_found` → 404 (`categories.ts:139-160`, `category-http.ts:19-20`).
- Przeniesienie `expenses.ts` → `expenses/index.ts` (jak `categories`, `recurring-*`) zachowuje adres `/api/expenses`.
- Unia typów w `json()` jest zamknięta (`src/lib/http.ts:9-14`) — nowy typ odpowiedzi trzeba dopisać.
- Ręcznie napisane type guardy (`isSavedEntry`, `isApiError`, `isRecord`) są zduplikowane w każdym hooku.
- `buildSavedResponse` zwraca sumy bieżącego miesiąca (`month.ts:22-30`); dla historii z innego miesiąca odpowiedź musi mówić, który miesiąc się zmienił.

### Hooki i UI

- Hooki akcji (`useCategoryActions`, `useRecurringActions`, `useRecurringIncomeActions`): `items`, `pending`, `error: {target, message}`, jedno prywatne `call(...)`, po 404/409 `window.location.reload()`, serwer zwraca świeżą listę po każdej mutacji (`useRecurringActions.ts:51-91`).
- `EntrySheet` (`src/components/month/EntrySheet.tsx`): wewnętrzny `EntryForm` startuje z pustym stanem, bez `initialValues` i bez id; `useEntrySubmit` ma na sztywno `POST /api/${kind}` (`useEntrySubmit.ts:75-81`); po zapisie formularz się resetuje i wraca fokus (tryb szybkiego wpisywania). Do edycji nadaje się szkielet (Drawer wybierany `useMediaQuery`, `CategoryGrid`, pola kwoty/daty), nie sam komponent. `CategoryGrid` dostaje tylko aktywne kategorie.
- Usuwanie: dwuetapowe potwierdzenie inline („Na pewno? …”, `role="group"`) w `CategoryManager.tsx:25-71` i `RecurringManager.tsx:85-128`; kontrolki nie są współdzielone.
- Nawigacja miesiąca: ekran miesiąca zawsze pokazuje bieżący miesiąc (`dashboard.astro:110`); brak parsowania `?month=`. Precedens parametrów URL: `settings/recurring.astro:14` (`?typ=`) i nawigacja linkami z `aria-current` (`:44-58`); precedens walidacji zodem: `src/pages/auth/callback.ts:10`.
- Link „Historia” naturalnie obok „Miesiąc” w `Topbar.astro:41-43`; nowa strona wymaga wpisu w `PROTECTED_ROUTES` (`src/middleware.ts:4` = `["/dashboard", "/settings", "/auth/update-password"]`, dopasowanie `startsWith`).
- Brakujące helpery dat: następny/poprzedni miesiąc, parser `YYYY-MM` (`src/lib/dates.ts` ma tylko `todayInWarsaw`, `monthStartOf`, `currentMonthStart`, `isRealDate`, `formatMonthLabel`).
- Marker „zarchiwizowana”: pigułka w `CategoryManager.tsx:245-278`; `list_recurring_expenses` już zwraca `category_name` i `category_archived` (`20261011130000:251-281`) — gotowy wzorzec.

### Lokalizacje `source` (koszt zmiany w S-07)

Baza: `20261008233243:34`, `20261012100000:6-7,20,36,73,88,92,122-123,168-169,211-237`. Kod: `src/types.ts:1,3,63`; `services/recurring-incomes.ts:3,8,22,37,66`; `api/incomes.ts:8,14,33,37`; `api/recurring-incomes/index.ts:8,15,35,37`; `useRecurringIncomeActions.ts:12,27`; `EntrySheet.tsx:20,104,137,147,203-214`; `RecurringIncomeReminders.tsx:29,34`; `RecurringIncomeManager.tsx:11,36,136,157,180,249-262,333-351`; testy pgTAP (`expenses_income.test.sql:67,94-97`, `recurring_incomes.test.sql:46,78-80,94,100,272,322,327`). Dla S-06: widok historii powinien brać etykietę przychodu z jednej funkcji/pola (np. `label`), a nie z `source` rozsianego po komponentach.

### Narzędzia i ograniczenia

- Brak vitest/jest/playwright w `package.json`; testy to pgTAP (`supabase/tests/database/`, 5 plików) i `scripts/smoke.mjs` (Node, bez przeglądarki).
- `context/foundation/infrastructure.md:66-68,97`: strony SSR niepre-renderowane, ryzyko renderowania `[object Object]` przy `nodejs_compat` — rozszerzyć smoke o asercję na realnie wyrenderowaną treść; limit CPU 10 ms w darmowym planie → lista ograniczona do jednego miesiąca / paginacja (odczyt z subagenta; nie weryfikowałem treści tego pliku samodzielnie).

## Code References

- `src/lib/services/month.ts:9-30` — jedyny odczyt: `month_summary`; `buildSavedResponse`
- `src/pages/api/expenses.ts:13-18,39,47` / `src/pages/api/incomes.ts:12-16,37` — POST, schematy, mapowanie 23503
- `src/pages/api/categories/[id].ts:18-51` — wzorzec PATCH/DELETE
- `src/lib/validation.ts:28-31` — `dateField` odrzuca przyszłość
- `supabase/migrations/20261008233243_first_expense_and_income.sql:16-64` — tabele i polityki SELECT/INSERT
- `supabase/migrations/20261011130000_recurring_expenses.sql:64-66,143-174,216-233` — DELETE tylko dla wygenerowanych; zmiana kwoty; stop
- `supabase/migrations/20261012100000_recurring_incomes.sql:63-65,103-134,176-193` — odpowiedniki dla przychodów
- `src/components/month/EntrySheet.tsx:38-289` — formularz tylko do tworzenia
- `src/components/settings/CategoryManager.tsx:25-71,245-278` — potwierdzenie usunięcia, pigułka „zarchiwizowana”
- `src/middleware.ts:4` — `PROTECTED_ROUTES`
- `src/components/Topbar.astro:41-43` — link „Miesiąc”

## Architecture Insights

- Wzorzec warstw: serwis zwraca `{ok, ...}`/`{ok:false, code}`, osobny `*-http.ts` mapuje kody na polskie komunikaty i statusy; serwer po mutacji zwraca świeżą listę, a gdy ponowny odczyt się nie uda — `null` i klient przeładowuje stronę.
- RLS ukrywa cudze/nieistniejące wiersze bez błędu, więc „brak wiersza” rozpoznaje się po pustym `select("id")`.
- Filtr kategorii: najczystsze dla S-07 jest wspólne API listy z parametrem `category` (uuid) i `kind`/typ wpisu; dopóki przychody mają `source`, filtr kategorii stosuje się tylko do wydatków (decyzja produktowa do planu: ukryć filtr, gdy pokazuje się przychody, czy pokazywać oba rodzaje i filtrować tylko wydatki).
- Układ mobile-first: `max-w-md`, kontrolki `min-h-11`, brak poziomego przewijania (`prd.md:119`).

## Historical Context (from prior changes)

- `context/archive/2026-10-09-category-management/plan.md:36`, `reviews/impl-review.md:113-115` — `POST /api/expenses` celowo nie odrzuca zarchiwizowanej kategorii; „revisit in S-06”. Status: zaakceptowane/odroczone; nierozstrzygnięte dla endpointu edycji.
- `context/archive/2026-10-11-recurring-expenses/plan-brief.md:55-56` — zmiana kwoty nie poprawia wpisu z datą dziś lub wcześniejszą (naprawa ręczna w S-06); ręcznie usunięty przyszły wpis wraca po edycji kwoty. Oba twierdzenia potwierdzone w kodzie RPC (patrz wyżej).
- `context/archive/2026-10-11-recurring-expenses/reviews/impl-review.md:35-37` — skutek edycji kategorii pojedynczego wpisu dla definicji nigdy nie był rozważany (luka).
- `context/archive/2026-10-11-recurring-expenses/plan.md:275` — sprawdzić obcinanie dnia 31 w krótkich miesiącach „po S-06 w historii”.
- `context/archive/2026-10-12-recurring-income/change.md:12-13` i `roadmap.md:155` — przychód zachowuje `source`; S-07 podmieni na `category_id`, więc ograniczać użycia `source`.
- `context/foundation/roadmap.md:116` — przetestować oznaczanie zarchiwizowanych kategorii na widoku historii z S-06.
- `context/foundation/roadmap.md:172-182` — S-07: pytania o wspólną tabelę `categories` z `kind` i zachowanie usuwania kategorii z przychodami; po S-07 ochrona usuwania kategorii musi sprawdzać też przychody (dziś tylko FK z wydatków).
- PRD: FR-009 (`prd.md:77`) wymaga widocznego oznaczenia zarchiwizowanych kategorii w historii; FR-018 mówi o „past expenses”, roadmap S-06 rozszerza to na przychody (rozbieżność zakresu: patrz pytania otwarte).
- `opis_aplikacji.txt:320-337,506,515` (z raportu subagenta): filtr po osobie jest później; w MVP miesiąc i kategoria.

## Related Research

- `context/archive/2026-10-11-recurring-expenses/research.md`, `context/archive/2026-10-12-recurring-income/research.md`, `context/archive/2026-10-09-category-management/research.md` — poprzednie badania powiązanych podsystemów (nie czytane w całości w tej sesji; wykorzystane przez cytaty z `plan-brief`/`reviews`).

## Open Questions

1. **Edycja wygenerowanych wpisów a RPC:** czy po ręcznej edycji przyszłego wygenerowanego wpisu akceptujemy, że zmiana kwoty definicji go nadpisze (stan obecny), czy dodać znacznik „edytowany” / ograniczyć edycję tylko do wpisów z datą <= dziś?
2. **Data przy edycji:** `dateField` odrzuca przyszłość, a wygenerowane wpisy mogą być w przyszłości — czy edycja ma omijać tę regułę (przynajmniej dla niezmienionej daty)? Czy historia pokazuje wpisy z przyszłości w bieżącym miesiącu?
3. **Zakres historii:** FR-018 mówi o wydatkach, roadmap S-06 o wydatkach i przychodach (FR-020). Jeden widok z przełącznikiem rodzaju, czy lista mieszana? Przed S-07 przychody nie mają kategorii — co robi filtr kategorii przy przychodach?
4. **Kategoria przy edycji:** czy odrzucać wybór zarchiwizowanej kategorii (z wyjątkiem obecnej kategorii wpisu)? Decyzja odroczona z category-management.
5. **Polityki RLS:** zastąpić wąskie `*_delete_generated` jednym DELETE dla gospodarstwa, czy dodać obok? Czy UPDATE ma ograniczać kolumny (tylko przez API)?
6. **Paginacja/limit:** czy jeden miesiąc wystarcza jako granica listy (limit CPU), czy dodać limit wierszy?
7. **PostgREST embed** `categories(name, archived_at)` przez FK kompozytowy — niezweryfikowane (subagent nie sprawdził); alternatywa: RPC jak `list_recurring_expenses` lub osobny odczyt kategorii i złączenie w TS.
8. **Kolizja slotu:** edycja daty wygenerowanego wpisu może dać dwa wpisy w jednym slocie (brak unikalnego indeksu) — akceptowalne czy blokować?
9. **Co po usunięciu ostatniego wygenerowanego wpisu** definicji (FK pozwala; kategoria staje się usuwalna, definicja pozostaje i jej RPC będą nadal regenerować) — zamierzone?

**Nie sprawdzono:** pełnych treści plików pgTAP, `scripts/smoke.mjs`, `recurring-*` tras `index.ts`, `infrastructure.md` i archiwalnych `research.md` (tylko cytaty przez subagentów i grep); nie uruchamiano testów ani buildu.
