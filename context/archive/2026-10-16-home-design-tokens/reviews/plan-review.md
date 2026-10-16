<!-- PLAN-REVIEW-REPORT -->
# Plan Review: Strona główna na tokenach stylów

- **Plan**: context/changes/home-design-tokens/plan.md
- **Mode**: Deep (weryfikacja kodu bez sub-agenta)
- **Date**: 2026-10-16
- **Verdict**: SOUND
- **Findings**: 0 critical, 1 warning, 2 observations

## Verdicts

| Dimension | Verdict |
|-----------|---------|
| End-State Alignment | PASS |
| Lean Execution | PASS |
| Architectural Fitness | PASS |
| Blind Spots | WARNING |
| Plan Completeness | WARNING |

## Grounding

8/8 paths ✓, symbole `cn`/`buttonVariants`/`Card`/`CLEAN_PATHS`/ESLint-ignore ✓, statyczny React w `.astro` ✓ (`src/pages/dev/dashboard-states.astro:109-143`), brief↔plan ✓, Progress↔Fazy 12/12 ✓.

## Findings

### F1 — Pomiar fokusu trafi w link Topbara zamiast CTA hero

- **Severity**: ⚠️ WARNING
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Blind Spots
- **Location**: Phase 1 — Skrypt „przed"; Phase 3 — Skrypt „po"
- **Detail**: Selektor `a[href="/auth/signin"]` trafia najpierw w link wariantu niezalogowanego Topbara (`Topbar.astro:167`), wcześniej w DOM i w kolejności tabulacji niż CTA hero (`Welcome.astro:30`). Link Topbara ma już `focusClass`, więc pomiar „przed" fałszywie pokazałby widoczny fokus. Faza 3 ma ten sam problem.
- **Fix**: Zawęzić oba skrypty do sekcji hero (lokator linków w rodzicu `h1`) i tabulować, aż `document.activeElement` będzie CTA hero.
- **Decision**: FIXED (kontrakty faz 1 i 3 zawężone do sekcji hero)

### F2 — Kontrakty skryptów Playwright nie pokrywają kryteriów

- **Severity**: 🔍 OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Plan Completeness
- **Location**: Phase 1 (1.2), Phase 3 (3.1, 3.6)
- **Detail**: (a) 1.2 wymaga `home-before-focus.txt`, a skrypt tylko zwraca obiekt; (b) 3.6 wymaga zrzutu stanu fokusu, którego kontrakt fazy 3 nie robi; (c) `transition-all` w `button.tsx:8` grozi odczytem stanu przejściowego; (d) brak sposobu stwierdzenia braku orbów i gwiazd.
- **Fix**: Implementer zapisuje wynik fokusu do txt; skrypt fazy 3 robi zrzut `home-after-focus-<szerokość>.png`; czekanie na koniec przejścia po hover/Tab; brak dekoracji = brak elementów z klasą `blur-` i atrybutu `style` z `radial-gradient`.
- **Decision**: FIXED (kontrakty faz 1 i 3 uzupełnione o zapis txt, zrzut fokusu, czekanie na przejście i test braku dekoracji)

### F3 — Lista zamierzonych różnic pomija cień CTA

- **Severity**: 🔍 OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: End-State Alignment
- **Location**: Phase 3 — Manual 3.5; brief „Open Risks"
- **Detail**: `buttonVariants` dodaje `shadow-xs` w `default` i `outline` (`button.tsx:12,16`); kryterium 3.5 wymienia tylko cztery różnice.
- **Fix**: Dopisać `shadow-xs` na CTA do listy zamierzonych różnic w 3.5 i w briefie (albo `shadow-none` w `cta`).
- **Decision**: FIXED (wariant `shadow-none` w `cta`; lista zamierzonych różnic bez zmian)
