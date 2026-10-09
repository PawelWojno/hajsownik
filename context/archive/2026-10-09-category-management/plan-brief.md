# Category Management — Plan Brief

> Full plan: `context/changes/category-management/plan.md`
> Research: `context/changes/category-management/research.md`

## What & Why

Użytkownik dostaje stronę, na której dopasowuje listę kategorii do swojego gospodarstwa: dodaje, zmienia nazwę, układa kolejność, archiwizuje, przywraca i usuwa. Realizuje to S-02 z roadmapy (FR-007..FR-011).

## Starting Point

12 domyślnych kategorii istnieje i jest tylko do odczytu (jedna polityka SELECT). Wydatki wskazują kategorię przez `category_id`, a ekran miesiąca czyta wszystkie kategorie bez filtra. Brak UI, API i kolumny archiwizacji.

## Desired End State

W menu „Ustawienia” → „Kategorie” użytkownik zarządza listą; zmiany od razu widać w siatce wyboru na ekranie miesiąca. Zarchiwizowane kategorie znikają z siatki, ale zostają w bazie i można je przywrócić.

## Key Decisions Made

| Decision | Choice | Why | Source |
| --- | --- | --- | --- |
| Miejsce w UI | Osobna strona `/settings/categories` pod rozwijanym menu „Ustawienia” | Menu rośnie o kolejne opcje (np. osoby w gospodarstwie); nie obciąża szybkiego dodawania wydatków | Plan (użytkownik) |
| Unikalność nazw | Case-insensitive, indeks `(household_id, lower(name))` | Zgodne z celem FR-007: brak rozbitych sum | Plan |
| Przywracanie | Tak, `archived_at` wraca do NULL | Pomyłkę można cofnąć w aplikacji | Plan |
| Usuwanie | Liczy się tylko użycie; zarchiwizowana nieużyta może zostać usunięta | Jedna reguła, zgodna z literalnym FR-008 | Plan |
| Reguła „usuń tylko nieużytą” | Egzekwuje FK (`23503`), API mapuje komunikat | Jedno źródło prawdy, brak wyścigu | Research |
| Archiwizacja | Kolumna `archived_at timestamptz null` | Zachowuje moment archiwizacji, filtr `is null` | Plan |
| Kolejność | RPC `reorder_categories(ids[])`, przyciski ↑/↓ | Atomowa zmiana, bez drag-and-drop | Plan |
| Nowa kategoria | RPC `add_category` (`max+1`) | Spełnia „kolejność tworzenia” z FR-011 | Plan |

## Scope

**In scope:** migracja i RLS, RPC, pgTAP (także jako krok w CI), API, strona zarządzania, menu „Ustawienia”, filtr na ekranie miesiąca, rozszerzenie smoke.

**Out of scope:** drag-and-drop, widok historii (S-06), inne gałęzie ustawień, role w gospodarstwie; odłożone (roadmap → Parked): limit liczby kategorii, ikony/kolory kategorii.

## Architecture / Approach

Baza trzyma reguły (RLS, unikalność, FK), cienkie trasy `/api/categories*` mapują błędy na polskie komunikaty i zwracają świeżą listę, wyspa React podmienia stan odpowiedzią. `/settings` jest chronione w middleware.

## Phases at a Glance

| Phase | What it delivers | Key risk |
| --- | --- | --- |
| 1. Baza danych | Migracja, polityki, RPC, pgTAP + krok `supabase test db` w CI | Podmiana constraintu unikalności (nazwa constraintu) |
| 2. Serwis i API | Endpointy + filtr archiwizacji na `/dashboard` | Kontrakt smoke `data-category-ids` |
| 3. UI i nawigacja | Menu, strona, smoke | Czytelność akcji na telefonie |

**Prerequisites:** S-01 wdrożone (tak), lokalny Supabase (Docker). Przed merge PR: `npx supabase db push` na produkcję (deploy w CI nie stosuje migracji).
**Estimated effort:** ~3 sesje, po jednej na fazę.

## Open Risks & Assumptions

- Kolejność wdrożenia: najpierw `db push`, potem merge; w przeciwnym razie `/dashboard` odpytuje nieistniejącą kolumnę `archived_at`.
- Archiwizacja nie blokuje zapisu wydatku do tej kategorii przez API (świadomie, v1); zapis do zarchiwizowanej z nieodświeżonej karty jest możliwy.
- Zakładam domyślną nazwę constraintu `categories_household_id_name_key`; sprawdzić przed `drop constraint`.
- Historia (S-06) nie istnieje; oznaczanie zarchiwizowanych w historii zweryfikujemy dopiero tam.
- `<details>` w Topbar nie zamyka się po kliknięciu poza menu; akceptowalne w v1.

## Success Criteria (Summary)

- Wszystkie pięć operacji działa na stronie i jest widoczne na ekranie miesiąca.
- Użyta kategoria nie da się usunąć; użytkownik dostaje wskazówkę o archiwizacji.
- pgTAP, lint, `astro check`, build i smoke są zielone.
