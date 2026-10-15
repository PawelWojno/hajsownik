<!-- IMPL-REVIEW-REPORT -->
# Implementation Review: Dashboard design tokens

- **Plan**: context/changes/dashboard-design-tokens/plan.md
- **Scope**: Full plan
- **Reviewed phases**: 1, 2, 3, 4, 5
- **Date**: 2026-10-15
- **Verdict**: APPROVED
- **Findings**: 0 critical 1 warnings 3 observations

## Verdicts

| Dimension | Verdict |
|-----------|---------|
| Plan Adherence | PASS |
| Scope Discipline | PASS |
| Safety & Quality | PASS |
| Architecture | PASS |
| Pattern Consistency | WARNING |
| Success Criteria | PASS |

## Findings

### F1 — Dwie ręcznie utrzymywane listy oczyszczonych plików

- **Severity**: ⚠️ WARNING
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Pattern Consistency
- **Location**: scripts/check-ui-tokens.mjs:10-17 (`CLEAN_PATHS`), package.json (`lint-staged`, klucz z listą ścieżek)
- **Detail**: Ta sama lista plików jest w skrypcie (dla `npm run check:ui`) i w kluczu `lint-staged`. `CLAUDE.md` każe przy migracji kolejnego widoku dopisać go w obu miejscach; jeśli ktoś zapomni o jednym, pre-commit i `check:ui` zaczną sprawdzać różne zbiory bez żadnego sygnału. Przy przepisywaniu kolejnych widoków (history, settings, auth) to realne ryzyko rozjazdu.
- **Fix**: Jedno źródło: `lint-staged` wywołuje skrypt dla wszystkich `*.{tsx,astro}`, a skrypt sam odfiltrowuje podane pliki do `CLEAN_PATHS`; regułę w `CLAUDE.md` skrócić do „dopisz widok do `CLEAN_PATHS`”.
- **Decision**: FIXED — jedna lista CLEAN_PATHS; lint-staged przekazuje pliki ze stagingu, skrypt filtruje; reguła w CLAUDE.md zaktualizowana

### F2 — Plan mówi o „7 plikach”, kontrola obejmuje 10

- **Severity**: 👁️ OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Plan Adherence
- **Location**: context/changes/dashboard-design-tokens/plan.md (Phase 3 i 5, Success Criteria i Progress 3.1, 5.1), plan-brief.md (Success Criteria)
- **Detail**: Kryteria mówią o skanie „na 7 plikach widoku”, a ostatecznie kontrola obejmuje 10 plików (7 widoku + `ServerError.tsx` + strona dev i `DisabledSelectDemo.tsx` z fazy 4). To rozszerzenie jest uzasadnione, ale plan i brief tego nie odnotowują; ktoś czytający archiwum zobaczy niezgodność liczb.
- **Fix**: Zostawić (dokumentacja historyczna) albo dopisać jedno zdanie do addendum fazy 3/5 w planie.
- **Decision**: FIXED — zdanie o 10 plikach w addendum fazy 3 w plan.md

### F3 — Jasny motyw `:root` jest niespójny i niesprawdzony

- **Severity**: 👁️ OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Architecture
- **Location**: src/styles/global.css (`:root`), src/layouts/Layout.astro:14
- **Detail**: Zgodnie z decyzją aplikacja jest ciemna przez `<html class="dark">`, a jasne `:root` czeka na przełącznik. Obecnie `:root` łączy białe `--background`/`--card` z ciemnymi `--cosmic-*` (tło `bg-cosmic`) i neutralnym `--muted-foreground`, więc usunięcie klasy `dark` dałoby nieczytelny miks. To jest w zakresie „Nie robimy”, ale warto, żeby zmiana z przełącznikiem zaczęła od tego punktu.
- **Fix**: Zostawić; w `tokens.md` jest już zapis „light values are not visually verified”. Przy zmianie z przełącznikiem zacząć od `:root` i kitchen-sink w obu motywach.
- **Decision**: ACCEPTED-AS-RULE: Jasny motyw (:root) trzeba utrzymywać razem z ciemnym (.dark)

### F4 — Pomysł z menu (zamykanie po kliknięciu obok) nie został zapisany

- **Severity**: 👁️ OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Scope Discipline
- **Location**: src/components/Topbar.astro (elementy `<details>` menu hamburger i „Ustawienia”)
- **Detail**: W fazie 3 użytkownik zauważył, że menu nie zamyka się po kliknięciu poza nim (natywne zachowanie `<details>`, nie regresja). Uzgodniono, że to osobna zmiana funkcjonalna, ale pomysł nie trafił nigdzie poza rozmowę, więc zniknie po zamknięciu sesji.
- **Fix**: Dopisać jedną linię do `context/changes/dashboard-design-tokens/follow-ups/review-fixes.md` jako pomysł na kolejną zmianę.
- **Decision**: FIXED — zapisane w follow-ups/review-fixes.md
