# Cykliczne wydatki (S-04) — Plan Brief

> Full plan: `context/changes/recurring-expenses/plan.md`
> Research: `context/changes/recurring-expenses/research.md`

## What & Why

Użytkownik definiuje cykliczny wydatek (kwota, kategoria, dzień miesiąca, horyzont, domyślnie 12 mies.), a aplikacja od razu tworzy prawdziwe wpisy, po jednym na miesiąc, od miesiąca utworzenia. Można zmienić kwotę, przedłużyć horyzont albo zatrzymać definicję. Bez schedulera, bo horyzont jest materializowany z góry (decyzja z doboru stacku); w zamian baner przypomina o kończącym się horyzoncie. To slice S-04 z roadmapy (FR-014, FR-015).

## Starting Point

Schemat nie zna cykliczności: `expenses` ma tylko polityki SELECT/INSERT i nie ma kolumny łączącej wpis z definicją. Zostały gotowe wzorce: funkcje SQL przez `rpc` (`reorder_categories`), ekran zarządzania (`CategoryManager`) i testy pgTAP.

## Desired End State

W Ustawieniach → „Cykliczne wydatki" użytkownik dodaje, edytuje kwotę, przedłuża i zatrzymuje definicje, a „Zostaje" bieżącego miesiąca od razu uwzględnia wygenerowany wpis. Zbliżający się koniec horyzontu sygnalizuje zamykalny baner na ekranie miesiąca.

## Key Decisions Made

| Decision | Choice | Why (1 sentence) | Source |
| --- | --- | --- | --- |
| Dzień wpisu | Wybiera użytkownik (1–31, przycinany do ostatniego dnia miesiąca) | Daty zgodne z realnym terminem rachunku | Plan |
| „Przyszłe" wpisy | `spent_on` późniejsze niż dziś (Warszawa) | Opłacony już czynsz nie znika przy zatrzymaniu w środku miesiąca | Plan |
| Model danych | Osobna tabela `recurring_expenses` + `expenses.recurring_expense_id` | Zwykłe złożone FK z RLS; S-05 dostaje bliźniaczą tabelę | Plan |
| Mechanizm | Funkcje SQL INVOKER przez `rpc` + wąska polityka DELETE na wpisach generowanych | Atomowo i jedno podzapytanie z Workera; nie wchodzi w zakres S-06 | Research |
| Baner | W zakresie; zamykalny, zapis w bazie, akcja „Przedłuż" | Domyka obietnicę PRD „przedłuż albo pozwól wygasnąć" bez nagabywania | Plan |
| Horyzont | Domyślnie 12 mies.; po każdej operacji najwyżej 24 mies. łącznie z bieżącym (przedłużać można bez końca) | Ogranicza liczbę przyszłych wpisów, a czynsz nie wygasa na stałe | Plan |
| UI | Osobna strona `/settings/recurring` | Szybka ścieżka dodawania wydatku (`EntrySheet`) zostaje nietknięta | Plan |
| „Dziś" | Liczone w bazie w Europe/Warsaw | Jedno źródło prawdy, brak cofania daty przez `rpc` | Research |

## Scope

**In scope:** tabela i funkcje SQL z pgTAP, endpointy, strona zarządzania, baner z „Przedłuż"/„Nie przypominaj", krok w smoke, pomiar CPU na produkcji.

**Out of scope:** cykliczne przychody (S-05), historia i edycja pojedynczych wpisów (S-06), edycja kategorii/dnia/horyzontu definicji, przywracanie zatrzymanych, limity liczby definicji, zmiany w `EntrySheet`.

## Architecture / Approach

`recurring_expenses` trzyma kwotę, kategorię, dzień oraz `start_month`/`end_month`; wpisy `expenses` wskazują ją przez `recurring_expense_id`. Sześć funkcji `rpc` realizuje create / zmień kwotę / przedłuż / zatrzymaj / ukryj przypomnienie / lista (z `months_left` i `remind`). Endpointy `POST` i `PATCH`/`DELETE /api/recurring-expenses` zwracają świeżą listę jak `categories`; strona i baner korzystają z jednego hooka.

## Phases at a Glance

| Phase | What it delivers | Key risk |
| --- | --- | --- |
| 1. Baza + pgTAP | Migracja, polityki, funkcje SQL, testy | Reguły dat (dzień 31, granica „dziś") i prawa do funkcji pomocniczych |
| 2. API i serwis | Endpointy, typy, mapowanie błędów | Rozjazd kodów błędów SQL i komunikatów |
| 3. Strona zarządzania | `/settings/recurring` z listą i akcjami | Hydratacja wysp i potwierdzenia w miejscu |
| 4. Baner, smoke, domknięcie | Baner, krok smoke, `db push`, pomiar CPU | Zmiana bieżącego miesiąca w smoke; migracja przed merge |

**Prerequisites:** S-01 (done). **Estimated effort:** ~3–4 sesje w 4 fazach.

## Open Risks & Assumptions

- „Łącznie do 24" znaczy najwyżej 24 miesiące licząc od bieżącego włącznie (wariant C z triage, zaostrzony w fazie 3 po uwadze użytkownika), a nie 24 miesiące życia definicji; przedłużenie ponad tę granicę jest odrzucane.
- Edycja kwoty nie poprawia wpisu z datą ≤ dziś; S-06 pozwoli go poprawić ręcznie.
- Ręcznie usunięty (S-06) przyszły wpis wraca przy edycji kwoty, bo regeneracja odtwarza wszystkie przyszłe sloty (zgodnie z FR-015); przedłużenie tylko dopisuje sloty za końcem horyzontu i dziur wewnątrz nie łata.
- Limit CPU Workera (10 ms) nie jest zmierzony w repo; pomiar ręczny w Phase 4.
- Dwie w pełni identyczne aktywne definicje (kategoria, kwota, dzień) z tego samego miesiąca są odrzucane jako podwójny submit; obejście to inna kwota lub dzień.

## Success Criteria (Summary)

- Definicja generuje poprawnie datowane wpisy, a edycja/zatrzymanie nie ruszają wpisów z datą ≤ dziś (pgTAP).
- Pełny cykl create → zmiana → zatrzymanie działa w smoke i ręcznie na telefonie.
- Baner pojawia się, gdy po bieżącym miesiącu zostaje < 2 miesiące, i można go zamknąć na stałe.
