# Historia wpisów z edycją i usuwaniem (S-06) — Plan Brief

> Full plan: `context/changes/expense-history-and-edits/plan.md`
> Research: `context/changes/expense-history-and-edits/research.md`

## What & Why

Dodajemy stronę historii wydatków i przychodów (filtr miesiąca i kategorii) oraz edycję i usuwanie dowolnego wpisu, także tego wygenerowanego z cyklu (FR-018–FR-020). Bez tego użytkownik widzi błąd w sumie „Zostaje”, ale nie ma jak go poprawić; PRD uznaje historię bez edycji za „pół-użyteczną”.

## Starting Point

Aplikacja tylko zapisuje wpisy (POST) i czyta sumy miesiąca; nie ma żadnej listy wpisów. Baza blokuje UPDATE i DELETE ręcznych wpisów, a RPC cykliczne rozpoznają „przyszłość” tylko po dacie, więc ręczna zmiana przyszłego wpisu zostanie nadpisana po zmianie kwoty cyklu. Ekran miesiąca pokazuje zawsze bieżący miesiąc i tak zostaje.

## Desired End State

`/history` pokazuje wpisy miesiąca od najnowszych, z zakładkami Wydatki/Przychody, strzałkami miesiąca, filtrem kategorii dla wydatków i oznaczeniami (cykliczny, zaplanowany, zarchiwizowana). Wpis można edytować i usunąć; wpis cykliczny pozwala zmienić tylko kwotę. Tytuł na ekranie miesiąca prowadzi do historii bieżącego miesiąca, a w edycji kwoty cyklu widać podpowiedź, że zmiana nadpisze przyszłe wpisy.

## Key Decisions Made

| Decision | Choice | Why (1 sentence) | Source |
| --- | --- | --- | --- |
| Edycja wpisu cyklicznego a RPC | RPC bez zmian; stała podpowiedź „Zmiana kwoty cyklu nadpisze przyszłe wpisy.” w edycji kwoty cyklu | Znacznik `edited_at` z licznikiem dotykał S-04/S-05 i funkcji list; podpowiedź załatwia ten sam scenariusz tanio | Plan (decyzja użytkownika) |
| Co można zmienić we wpisie cyklicznym | Kwotę i opis (data i kategoria zablokowane) | Spójność z definicją cyklu i brak duplikatu slotu; egzekwowane w triggerze | Plan |
| Wpisy z datą po dziś | Pokazane, oznaczone „zaplanowany” | Suma listy zgadza się z „Zostaje”, a nie-nadchodzący przychód da się usunąć | Plan |
| Układ | Zakładki Wydatki/Przychody (`?typ=`) | Wzorzec z `settings/recurring.astro`; filtr kategorii gotowy pod S-07 | Research / Plan |
| Filtr kategorii na przychodach | Brak do S-07; w wierszu źródło z jednej funkcji | Minimum miejsc ze `source` do przepisania | Research / Plan |
| Zarchiwizowana kategoria przy edycji | Dotychczasowa zostaje, nowy wybór odrzucany | Edycja kwoty starego wpisu nie wymusza zmiany kategorii | Plan |
| Formularz edycji | Uogólniony `EntrySheet` z trybem edycji | Jedna kopia pól; bliżej wspólnego formularza z S-07 | Plan |
| Kolejność i limit | Od najnowszych, limit 200 na rodzaj z komunikatem | Chroni limit CPU przy jednym miesiącu | Plan |
| Nawigacja | Link „Historia” w Topbar, strzałki tylko na `/history`, tytuł `/dashboard` jako link do historii | Ekran miesiąca zostaje bez zmian (bez `?month=` i trybu tylko do odczytu) | Plan (decyzja użytkownika) |
| Odczyt listy | Zwykłe zapytania + nazwy kategorii w TS, bez nowych RPC | Omija niezweryfikowane osadzanie przez klucz kompozytowy | Plan |

## Scope

**In scope:** migracja (trigger blokujący kolumny wpisów cyklicznych, polityki UPDATE/DELETE), serwis i trasy (`GET /api/history`, PATCH/DELETE `[id]`), `/history` ze strzałkami miesiąca, link w Topbar i w tytule ekranu miesiąca, tryb edycji `EntrySheet`, podpowiedź w menedżerach cykli, pgTAP i smoke.

**Out of scope:** kategorie przychodów (S-07), `edited_at` i ostrzeżenie z licznikiem, strzałki/`?month=`/tryb tylko do odczytu na ekranie miesiąca, stronicowanie, filtr po osobie/zakresie dat, podsumowanie per kategoria, znacznik „ręcznie usunięty”, edycja definicji cyklu.

## Architecture / Approach

Baza pilnuje reguły (trigger blokuje zmianę kolumn wpisu cyklicznego poza kwotą), serwis `entries.ts` robi odczyt i mutacje, a strona `/history` renderuje listę na serwerze i hydratuje jedną wyspę. Po edycji lub usunięciu wyspa pobiera świeże dane z `GET /api/history` (ten sam serwis), a przy błędzie przeładowuje stronę. Parametr `month` na `/history` waliduje `parseMonthParam`.

## Phases at a Glance

| Phase | What it delivers | Key risk |
| --- | --- | --- |
| 1. Baza i pgTAP | Trigger, polityki UPDATE/DELETE, testy | Istniejące asercje default-deny w trzech plikach testów |
| 2. Warstwa serwerowa | Serwis, trasy, schematy, typy | Reguła archiwum i `not_found` przez RLS |
| 3. Nawigacja i lista | Link w menu, tytuł jako link, `/history` ze strzałkami | Daty na granicy roku |
| 4. Edycja i usuwanie | Tryb edycji `EntrySheet`, akcje na wierszach | Regresja szybkiego dodawania |
| 5. Podpowiedź i smoke | Tekst w menedżerach cykli, smoke, roadmapa | Kolejność kroków w smoke |

**Prerequisites:** S-01, S-04, S-05 gotowe; lokalny Supabase (Docker) dla `supabase test db`.
**Estimated effort:** ~4 sesje w 5 fazach.

## Open Risks & Assumptions

- Ręcznie zmieniony lub usunięty przyszły wpis cykliczny jest po zmianie kwoty definicji nadpisany lub przywrócony; podpowiedź i komunikat przy usuwaniu to wyjaśniają, ale nie blokują.
- Przy ponad 200 wpisach miesiąca część jest niewidoczna do zawężenia filtrem.
- Zakładam, że istniejące testy pgTAP nie zależą od blokady DELETE ręcznych wpisów poza wskazanymi asercjami.

## Success Criteria (Summary)

- Użytkownik znajduje wpis w historii, poprawia lub usuwa go, a „Zostaje” miesiąca się zgadza.
- Edycja ani usunięcie wygenerowanego wpisu nie zatrzymuje cyklu; edycja kwoty cyklu uprzedza o nadpisaniu przyszłych wpisów.
- `supabase test db`, lint, `astro check`, build i smoke przechodzą.
