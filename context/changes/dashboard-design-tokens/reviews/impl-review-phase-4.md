<!-- IMPL-REVIEW-REPORT -->
# Implementation Review: Dashboard design tokens

- **Plan**: context/changes/dashboard-design-tokens/plan.md
- **Scope**: Phase 4 of 5
- **Reviewed phases**: 4
- **Date**: 2026-10-15
- **Verdict**: NEEDS ATTENTION
- **Findings**: 0 critical 2 warnings 1 observations

## Verdicts

| Dimension | Verdict |
|-----------|---------|
| Plan Adherence | WARNING |
| Scope Discipline | PASS |
| Safety & Quality | WARNING |
| Architecture | PASS |
| Pattern Consistency | PASS |
| Success Criteria | PASS |

## Findings

### F1 — Strona dev może zapisać prawdziwe dane, gdy jesteś zalogowany

- **Severity**: ⚠️ WARNING
- **Impact**: 🔎 MEDIUM — real tradeoff; pause to reason through it
- **Dimension**: Safety & Quality
- **Location**: src/pages/dev/dashboard-states.astro:75-93,180-188 (`MonthScreen ... client:load` ×3), :74 (`<Topbar />`), :2-3 (komentarz „No session, no Supabase”)
- **Detail**: Plan wymagał, żeby strona nie dotykała danych. Trzy `MonthScreen` są interaktywne (`client:load`), więc na stronie działa „Dodaj przychód” → „Zapisz”, a w przeglądarce z zalogowaną sesją (localhost dzieli ciasteczka) wywoła to `POST /api/incomes` i doda **prawdziwy przychód** do gospodarstwa (przychód nie wymaga ID kategorii). „Przedłuż” i „Nie przypominaj” wyślą zapytania z fałszywym ID `r1` (API odrzuci je walidacją `z.uuid()`, ale i tak trafiają do serwera). `Topbar` przy zalogowanym użytkowniku czyta nazwę gospodarstwa z Supabase i pokazuje wariant zalogowany, więc komentarz w pliku i podpis „wariant bez sesji” są w tym przypadku nieprawdziwe.
- **Fix**: Usunąć `client:load` z trzech `MonthScreen` — React wyrenderuje sam HTML bez skryptu, przyciski będą nieaktywne, a zrzuty wyglądają tak samo; poprawić komentarz i podpis Topbara („bez sesji, gdy niezalogowany”).
  - Strength: Strona służy tylko do zrzutów; statyczny HTML całkowicie usuwa możliwość zapisu i dodatkowo przyspiesza ładowanie.
  - Tradeoff: Nie da się na niej otworzyć panelu `EntrySheet`; panel i tak nie był widoczny na zrzutach.
  - Confidence: HIGH — `DisabledSelectDemo` już działa w ten sposób (SSR bez hydratacji).
  - Blind spot: Nie sprawdzono ręcznie, czy `MonthScreen` bez hydratacji renderuje się identycznie (powinien — to ten sam SSR).
- **Decision**: FIXED — usunięte client:load (statyczny HTML, 0 wysp), poprawiony komentarz i podpis Topbara

### F2 — Komórki N/A nie są opisane na stronie

- **Severity**: ⚠️ WARNING
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Plan Adherence
- **Location**: src/pages/dev/dashboard-states.astro (sekcje 1, 3, 6)
- **Detail**: Plan: „komórka bez sensu = N/A z powodem”. Na stronie opisane jest tylko N/A dla szkieletów ładowania (sekcja 7). Pozostałe N/A wymienił tylko podagent w raporcie: zalogowany wariant Topbara (wymaga sesji), pusta siatka kategorii (widoczna tylko w zamkniętym panelu), fokus na `Select` i „Więcej opcji” (wymaga interakcji). Kto otworzy stronę lub zrzut, nie dowie się o nich.
- **Fix**: Dodać pod nagłówkiem strony jedną linię „N/A:” z tymi trzema pozycjami i powodem.
- **Decision**: FIXED — linia N/A z powodami pod nagłówkiem strony

### F3 — Kod strony dev trafia do buildu produkcyjnego

- **Severity**: 👁️ OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Architecture
- **Location**: src/pages/dev/dashboard-states.astro:14-15
- **Detail**: W produkcji strona zwraca 404 (zweryfikowane), ale jej moduł jest w buildzie serwera i wykonuje się przy każdym wejściu na adres. Nie ujawnia danych (pokazuje tylko „Nie znaleziono.”), więc ryzyko jest pomijalne.
- **Fix**: Zostawić; jeśli przybędzie stron dev, rozważyć wykluczenie katalogu `src/pages/dev/` z buildu produkcyjnego.
- **Decision**: SKIPPED
