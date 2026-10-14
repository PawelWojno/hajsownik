<!-- IMPL-REVIEW-REPORT -->
# Implementation Review: Historia wpisów z edycją i usuwaniem (S-06)

- **Plan**: context/changes/expense-history-and-edits/plan.md
- **Scope**: Full plan (Phase 5 of 5)
- **Reviewed phases**: 1, 2, 3, 4, 5
- **Date**: 2026-10-14
- **Verdict**: NEEDS ATTENTION
- **Findings**: 0 critical, 4 warnings, 5 observations

Krok 5.7 (telefon) zostaje `- [ ]`. To oczekiwanie, nie pozorne odhaczenie. Reszta faz 1–5 jest w kodzie.

## Verdicts

| Dimension | Verdict |
|-----------|---------|
| Plan Adherence | WARNING |
| Scope Discipline | WARNING |
| Safety & Quality | WARNING |
| Architecture | PASS |
| Pattern Consistency | PASS |
| Success Criteria | PASS |

## Verification

Polecenia z kryteriów automatycznych, uruchomione 2026-10-14:

- `npx supabase db reset` — pass. Migracja `20261012180000_entry_edit_delete.sql` wstała czysto. Reset odtworzył lokalną bazę od zera (dane deweloperskie sprzed resetu przepadły).
- `npx supabase test db` — pass. 6 plików, 285 testów, w tym `entry_edit_delete.test.sql`.
- `npm run lint` — pass.
- `npx astro check` — pass. 86 plików, 0 błędów.
- `npm run build` — pass.
- `npm run smoke` przeciw działającemu `npm run dev` — fail, 68× HTTP 500. Przyczyna w logu serwera: `astro check` / `astro build` przebudowały cache Vite (`node_modules/.vite/deps_ssr/zod.js`), a stary proces dev dalej go czytał. To nie jest błąd aplikacji.
- `BASE_URL=http://localhost:4322 npm run smoke` przeciw `astro preview` ze świeżego buildu — pass. Wszystkie kroki, łącznie z historią, PATCH/DELETE i linkiem z dashboardu.

Ręczne kroki oznaczone `[x]` mają ślad w kodzie albo w pgTAP/smoke. 5.7 jest świadomie otwarty.

## Findings

### F1 — Odświeżenie listy może przywrócić usunięty wiersz

- **Severity**: 💡 OBSERVATION (obniżone w triage)
- **Impact**: 🔎 MEDIUM — real tradeoff; pause to reason through it
- **Dimension**: Safety & Quality
- **Location**: src/hooks/useHistoryActions.ts:69
- **Detail**: `refresh()` zapisuje każdą poprawną odpowiedź i nie ustawia `pending`. Po edycji `HistoryList.tsx:100` woła `refresh()`, a przyciski Edytuj i Usuń zostają aktywne. Na wolnej sieci da się w tym oknie usunąć wiersz: `remove()` ma własne odświeżenie, ale starszy GET z edycji może wrócić później i z powrotem pokazać usunięty wpis. W bazie wiersza już nie ma. Komentarz hooka (linie 59–60) obiecuje, że na czas żądania `pending` jest true.
- **Fix A ⭐ Recommended**: Numer żądania w `refresh()` — ignoruj odpowiedź, jeśli w międzyczasie wystartowało nowsze odświeżenie — i ustawiaj `pending` na czas GET.
  - Strength: Zamyka wyścig nawet wtedy, gdy dwa GET-y już lecą. Zgadza się z komentarzem hooka i z `disabled={pending}` na przyciskach.
  - Tradeoff: Kilkanaście linii w jednym hooku. Lista jest zablokowana na czas jednego odczytu.
  - Confidence: HIGH — oba wywołania (`handleEdited`, `remove`) są w tym samym hooku i da się je prześledzić bez innych wołających.
  - Blind spot: Nie odtworzyłem tego w przeglądarce na sztucznie spowolnionej sieci.
- **Fix B**: Tylko `pending` na czas `refresh()`, bez numeru żądania.
  - Strength: Krócej. Przyciski i tak są wyłączone przez `pending`, więc użytkownik nie zacznie drugiego żądania.
  - Tradeoff: Nie pomaga, jeśli dwa odświeżenia już lecą (edycja wystartowała, zanim kliknięto Usuń).
  - Confidence: MEDIUM — wystarcza na kliknięcie, nie na nakładające się odpowiedzi.
  - Blind spot: Ten sam co w Fix A.
- **Decision**: FIXED via Fix B — `pending` na czas `refresh()` (`try/finally`). Numer żądania zbędny: `refresh()` wołają tylko `handleEdited` i `remove`, oba zablokowane przez `pending`.

### F2 — Tytuł historii otwiera siatkę miesięcy, której plan nie opisywał

- **Severity**: ⚠️ WARNING
- **Impact**: 🔎 MEDIUM — real tradeoff; pause to reason through it
- **Dimension**: Scope Discipline
- **Location**: src/components/history/MonthPicker.tsx:38
- **Detail**: Plan: `<h1>` z etykietą „Miesiąc Rok” i strzałki `‹ ›`. Strzałki są (`history.astro:55-70`, `shiftMonth ±1`, aria-label, `min-h-11`, `typ` i `kategoria` zostają). Obok nich tytuł jest przyciskiem, który otwiera rok i siatkę miesięcy oraz „Bieżący miesiąc” (commit `41530f4`). Ekran miesiąca na `/dashboard` nadal nie ma strzałek ani `?month=`.
- **Fix A ⭐ Recommended**: Dopisz picker do planu jako addendum i zostaw kod.
  - Strength: Strzałki z kontraktu zostały. Picker jest dodatkiem, który już wszedł w commicie świadomie.
  - Tradeoff: Plan przestaje być wiernym opisem tego, co uzgodniono przed kodem.
  - Confidence: HIGH — diff i commit message mówią wprost o panelu z rokiem i siatką.
  - Blind spot: Nie sprawdzałem pickera palcem na telefonie (to jest otwarty krok 5.7).
- **Fix B**: Usuń `MonthPicker` i zostaw sam tekst tytułu między strzałkami.
  - Strength: Widok historii wraca do kontraktu.
  - Tradeoff: Znika działająca nawigacja, którą już zbudowano.
  - Confidence: HIGH — picker nie ma innych wołających poza `history.astro`.
  - Blind spot: None significant.
- **Decision**: FIXED via Fix A — addendum w `plan.md` (sekcja „Addendum (impl-review 2026-10-14)”); kod zostaje.

### F3 — Topbar przebudowany szerzej niż link „Historia”

- **Severity**: ⚠️ WARNING
- **Impact**: 🔎 MEDIUM — real tradeoff; pause to reason through it
- **Dimension**: Scope Discipline
- **Location**: src/components/Topbar.astro:15
- **Detail**: Plan: link „Historia” obok „Miesiąc”. Link jest (linie 15–18). Commit `ea75e1a` przebudował całe menu: nazwa gospodarstwa z bazy, menu `<details>` na wąskim ekranie, rozwijane Ustawienia (Kategorie / Cykliczne). Krok 3.6 (telefon, bez poziomego przewijania) jest odhaczony właśnie tym commitem.
- **Fix A ⭐ Recommended**: Zostaw menu i dopisz przebudowę do planu jako addendum kroku 3.6.
  - Strength: To jest ślad ręcznego sprawdzenia telefonu. Cofnięcie zabrałoby układ, który miał usunąć poziome przewijanie.
  - Tradeoff: Zakres S-06 urósł o nawigację, która nie była w kontrakcie.
  - Confidence: HIGH — commit i checkbox 3.6 wskazują ten sam SHA.
  - Blind spot: Nie mierzyłem szerokości na prawdziwym telefonie.
- **Fix B**: Cofnij menu do poprzedniego paska i zostaw tylko link „Historia”.
  - Strength: Zakres wraca do planu.
  - Tradeoff: Traci się układ pod telefon, na który wskazuje krok 3.6.
  - Confidence: MEDIUM — nie wiem, czy stary pasek znowu wymusi poziome przewijanie.
  - Blind spot: Nie porównałem starego paska na wąskiej szerokości.
- **Decision**: FIXED via Fix A — wpis w addendum `plan.md`; menu zostaje (cofnięcie przywróciłoby poziome przewijanie).

### F4 — Potwierdzenie usunięcia cyklu nie mówi, gdzie go zatrzymać

- **Severity**: ⚠️ WARNING
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Plan Adherence
- **Location**: src/components/history/HistoryList.tsx:172
- **Detail**: Plan: „Na pewno? Cykl nadal będzie generował kolejne wpisy — zatrzymasz go w Ustawienia → Cykliczne.” Kod: `"Na pewno?\nNie zatrzymuje cyklu."` Sens „cykl zostaje” jest. Zniknęła wskazówka, gdzie cykl zatrzymać. Łamanie na dwie linie jest świadome (commit `15ec58e`, `whitespace-pre-line`). Tekst ręcznego wpisu został, też w dwóch liniach: „Na pewno? Nie można cofnąć.”
- **Fix**: Zostaw dwie linie i przywróć wskazówkę, np. „Na pewno?\nCykl zostaje — zatrzymasz go w Ustawienia → Cykliczne.”
- **Decision**: DISMISSED — tekst to decyzja użytkownika (krótkie komunikaty), nie odchylenie. Obowiązujące teksty zapisane w addendum `plan.md`; wskazówka „Ustawienia → Cykliczne” odłożona do redakcji tekstów.

### F5 — Komunikat 22023 wspomina opis także przy przychodzie

- **Severity**: 💡 OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Plan Adherence
- **Location**: src/lib/entry-http.ts:17
- **Detail**: Plan: „Wpis z cyklu: można zmienić tylko kwotę”. Kod: „Wpis z cyklu: zmienisz tylko kwotę i opis”. Dla wydatku to bliższe triggerowi (kwota i opis). Dla przychodu trigger puszcza tylko kwotę (`incomes_guard_update`, migracja linie 56–59), a przychod nie ma opisu. Zwykły formularz i tak nie wyśle źródła ani daty cyklu.
- **Fix**: Osobny komunikat dla przychodu albo jeden neutralny: „Wpis z cyklu: można zmienić tylko dozwolone pola”.
- **Decision**: ACCEPTED (odroczone) — z UI nieosiągalny; notatka w `change.md`, poprawka przy redakcji tekstów.

### F6 — Komunikat przeniesienia brzmi inaczej niż w planie

- **Severity**: 💡 OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Plan Adherence
- **Location**: src/components/history/HistoryList.tsx:103
- **Detail**: Plan: „Przeniesiono do {miesiąc}”. Kod buduje `` `Przeniesiono: ${formatMonthLabel(date)}` ``, więc użytkownik widzi np. „Przeniesiono: październik 2026”. Komunikat pojawia się tylko wtedy, gdy data wychodzi z bieżącego miesiąca listy. Zachowanie jest, różni się sformułowanie i dopisek roku.
- **Fix**: Zmień szablon na `` `Przeniesiono do ${formatMonthLabel(date)}` ``.
- **Decision**: DISMISSED — poprawka z raportu niegramatyczna („do październik 2026”, mianownik z `formatMonthLabel`). Zastąpione wspólnym rozwiązaniem z F7: ogólne „Przeniesiono”.

### F7 — Przy filtrze kategorii zmiana kategorii chowa wpis bez komunikatu

- **Severity**: 💡 OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Plan Adherence
- **Location**: src/components/history/HistoryList.tsx:100
- **Detail**: Plan wymaga komunikatu tylko przy zmianie miesiąca. Gdy na liście jest filtr kategorii i edycja przenosi wpis do innej kategorii, `refresh()` zwraca listę bez tego wpisu, a `setMoved` zostaje puste, bo miesiąc się nie zmienił. Ta luka jest już zapisana w `change.md` (notatka z 2026-10-13). To nie jest złamanie kontraktu, tylko dziura obok niego.
- **Fix**: Gdy po edycji identyfikatora nie ma na odświeżonej liście, a miesiąc został ten sam, pokaż krótki komunikat, że wpis wypadł z filtra.
- **Decision**: FIXED (Fix differently, razem z F6) — `refresh()` zwraca świeżą listę; `handleEdited` pokazuje „Przeniesiono”, gdy edytowanego `id` nie ma na liście (inny miesiąc albo kategoria poza filtrem). Znane ograniczenie: przy `truncated` wpis może wypaść poza limit 200 i też dostać „Przeniesiono”.

### F8 — Status S-06 w roadmapie jest niezacommitowany

- **Severity**: 💡 OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Plan Adherence
- **Location**: context/foundation/roadmap.md:50
- **Detail**: Kontrakt fazy 5: status S-06 według konwencji `planning` → `in-progress` → `done`. HEAD nadal ma `proposed`. Working tree, bez commita, ustawia `in-progress` w tabeli i w sekcji S-06. To właściwy status: krok 5.7 jest otwarty, więc `done` byłoby za wcześnie.
- **Fix**: Zostaw `in-progress` i doceń `roadmap.md`. Nie ustawiaj `done`, dopóki 5.7 jest otwarty.
- **Decision**: FIXED — `roadmap.md` (S-06 `in-progress`) wchodzi do commita epilogu na branchu; `done` ustawi `/10x-archive`.

### F9 — Drobne dodatki poza kontraktem, zgodne z resztą repo

- **Severity**: 💡 OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Scope Discipline
- **Location**: src/lib/history-params.ts:1
- **Detail**: Poza planem, bez zmiany zachowania kontraktu: `parseHistoryParams` (zła wartość `typ` / `month` / `kategoria` wraca do domyślnej; filtr kategorii odpada na przychodach), `REVOKE EXECUTE` na funkcjach triggerów (ten sam wzorzec co `20261008200524_revoke_function_execute.sql`), w smoke dodatkowe zatrzymanie cyklu testowego oraz anonimowe `GET /history` → 302 i `GET /api/history` → 401, `autoComplete="off"` na opisie w `EntrySheet` (świadomie, notatka w `change.md`). Lista „What We're NOT Doing” jest nienaruszona: brak kategorii przychodów, brak `edited_at`, brak trybu tylko do odczytu na `/dashboard`, brak zmian RPC i `buildSavedResponse`.
- **Fix**: Zostaw kod. Przy addendum do planu dopisz jedną linijkę, że parser historii, revoke i asercje wylogowania są częścią S-06.
- **Decision**: FIXED — kod zostaje; linia w addendum `plan.md` (razem z wynikiem F6/F7).
