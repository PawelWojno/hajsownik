# Cykliczne przychody (S-05) — Plan Brief

> Full plan: `context/changes/recurring-income/plan.md`
> Research: `context/changes/recurring-income/research.md`

## What & Why

Użytkownik definiuje cykliczny przychód (źródło, kwota, dzień miesiąca, horyzont, domyślnie 12 mies.), a aplikacja od razu tworzy prawdziwe wpisy `incomes`, po jednym na miesiąc, od bieżącego miesiąca. Można zmienić kwotę, przedłużyć horyzont albo zatrzymać definicję. To slice S-05 (FR-016, FR-017): dokładny bliźniak S-04, bez schedulera, bo horyzont jest materializowany z góry.

## Starting Point

`incomes` ma `source` (5 wartości w CHECK) i `received_on`, tylko polityki SELECT/INSERT i nie zna cykliczności. Wzorzec S-04 (tabela, 6 funkcji `rpc`, pgTAP, serwis, trasy, hook, ekran zarządzania, baner, smoke) jest gotowy i działa na produkcji, ale warstwa aplikacji jest na sztywno wydatkowa.

## Desired End State

Na `/settings/recurring` przełącznik Wydatki / Przychody (`?typ=przychody`) pozwala dodać, zmienić kwotę, przedłużyć i zatrzymać cykliczny przychód, a „Zostaje” bieżącego miesiąca od razu uwzględnia wpis. Na ekranie miesiąca osobny, zamykalny baner przypomina o kończącym się horyzoncie przychodu.

## Key Decisions Made

| Decision | Choice | Why (1 sentence) | Source |
| --- | --- | --- | --- |
| Źródło przychodu | Zostaje `source` (CHECK), bez `category_id` | FR-012 obowiązuje w v1; własne kategorie przychodów to S-07 (post-MVP) | Plan |
| Model danych | Osobna tabela `recurring_incomes` + `incomes.recurring_income_id` | Bliźniak S-04, potwierdzony w jego planie | Research |
| Warstwa aplikacji | Duplikacja (własny hook, serwis, Manager, Reminders) | Zero ryzyka regresji w wydatkach, a S-07 i tak przebuduje stronę przychodów | Plan |
| UI | Jedna strona `/settings/recurring`, przełącznik w adresie `?typ=przychody` | Jedno miejsce na „cykliczne”, działa bez JS, testowalne w smoke zwykłym GET | Plan |
| Baner | Tak, symetryczny, osobny dla przychodów | FR-016 mówi „tak samo jak FR-014”, a wygasły przychód cicho zaniża „Zostaje” | Plan |
| Dzień wpisu | Wybiera użytkownik 1–31, przycinany do długości miesiąca | Pensja z 10. trafia na 10., funkcje SQL z testami reużywane | Plan |
| Reguły dat i horyzontu | Jak S-04 (przyszłe = po dziś w Warszawie, horyzont ≤ 24 mies. licząc od bieżącego) | Jedno źródło prawdy w bazie, wspólne funkcje pomocnicze | Research |
| Ochrona przed duplikatem | `pending` w UI + częściowy indeks unikalny + mapowanie 23505 | Wymóg lekcji w `lessons.md` | Research |

## Scope

**In scope:** migracja, polityki, funkcje SQL z pgTAP, serwis i trasy API, strona z przełącznikiem, baner, kroki smoke, `db push`, krótki pomiar CPU.

**Out of scope:** kategorie przychodów i zamiana `source` → `category_id` (S-07), edycja źródła/dnia/horyzontu definicji, przywracanie zatrzymanych, edycja i usuwanie pojedynczych wpisów (S-06), uogólnianie kodu S-04, zmiany w `EntrySheet`.

## Architecture / Approach

`recurring_incomes` trzyma źródło, kwotę, dzień oraz `start_month`/`end_month`; wpisy `incomes` wskazują ją przez `recurring_income_id`. Sześć funkcji `rpc` (create / zmień kwotę / przedłuż / zatrzymaj / ukryj przypomnienie / lista) korzysta z istniejących funkcji pomocniczych dat. Trasy `POST` i `PATCH`/`DELETE /api/recurring-incomes` zwracają świeżą listę; strona wybiera komponent po parametrze `typ`.

## Phases at a Glance

| Phase | What it delivers | Key risk |
| --- | --- | --- |
| 1. Baza + pgTAP | Migracja, polityki (w tym DELETE na wygenerowanych), funkcje SQL, testy | Reguły dat (dzień 31, granica „dziś”), prawa do funkcji |
| 2. API i serwis | Typy, serwis, mapowanie błędów, trasy | Rozjazd kodów błędów SQL i komunikatów |
| 3. Strona z przełącznikiem | Hook, `RecurringIncomeManager`, zakładki, etykieta „Cykliczne” w menu | Nie zepsuć strony wydatków, hydratacja wysp |
| 4. Baner, smoke, domknięcie | Baner, kroki smoke, `db push`, pomiar CPU | Kolejność kroków smoke (dwa banery „Nie przypominaj”), migracja przed merge |

**Prerequisites:** S-01 i S-04 (done). **Estimated effort:** ~3–4 sesje w 4 fazach.

## Open Risks & Assumptions

- Edycja kwoty nie poprawia wpisu z datą ≤ dziś (poprawi S-06); ręcznie usunięty przyszły wpis wraca przy edycji kwoty, a identyczne definicje z tego samego miesiąca są odrzucane jako podwójny submit — jak w S-04.
- Limit CPU Workera (10 ms) dla przychodów wynika z mechanizmu, nie z pomiaru; potwierdza go krótki pomiar w fazie 4.
- Zamiana `source` na `category_id` w S-07 obejmie `incomes` i `recurring_incomes`; dlatego `source` jest w jak najmniejszej liczbie miejsc.

## Success Criteria (Summary)

- Definicja generuje poprawnie datowane wpisy, a edycja/zatrzymanie nie ruszają wpisów z datą ≤ dziś (pgTAP).
- Pełny cykl create → zmiana → zatrzymanie działa w smoke i ręcznie na telefonie, a strona wydatków działa jak przed zmianą.
- Baner pojawia się, gdy po bieżącym miesiącu zostaje < 2 miesiące, i można go zamknąć na stałe.
