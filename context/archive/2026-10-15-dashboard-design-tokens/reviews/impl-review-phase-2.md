<!-- IMPL-REVIEW-REPORT -->
# Implementation Review: Dashboard design tokens

- **Plan**: context/changes/dashboard-design-tokens/plan.md
- **Scope**: Phase 2 of 5
- **Reviewed phases**: 2
- **Date**: 2026-10-15
- **Verdict**: APPROVED
- **Findings**: 0 critical 1 warnings 1 observations

## Verdicts

| Dimension | Verdict |
|-----------|---------|
| Plan Adherence | PASS |
| Scope Discipline | PASS |
| Safety & Quality | PASS |
| Architecture | PASS |
| Pattern Consistency | PASS |
| Success Criteria | PASS |

## Findings

### F1 — Tokeny nie odtwarzają tła pól formularza (`Input`/`Select`)

- **Severity**: ⚠️ WARNING
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Plan Adherence
- **Location**: src/styles/global.css:~74 (`.dark --input`), src/components/ui/input.tsx:10, src/components/ui/select.tsx:31
- **Detail**: Dzisiejsze pola (`fieldClass`) mają tło `bg-white/10` i ramkę `white/20`. Nowe `Input` i `Select` mają w ciemnym motywie tło `dark:bg-input/30`, czyli przy `--input` = 20% białego wychodzi ok. 6% białego zamiast 10%. Ramka się zgadza, tło byłoby ciemniejsze niż dziś, co zepsuje „bez zmiany wyglądu” w fazie 3.
- **Fix**: W fazie 3 przekazać do `Input`/`Select` `className="dark:bg-card"` (`cn` połączy konflikt `dark:bg-input/30`), zamiast zmieniać globalny `--input`.
- **Decision**: FIXED — dopisano wymóg dark:bg-card do Contract fazy 3 w plan.md

### F2 — Stałe `color-scheme: dark` w `<meta>` zepsuje przyszły jasny motyw

- **Severity**: 👁️ OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Architecture
- **Location**: src/layouts/Layout.astro:20
- **Detail**: Meta `color-scheme` jest na stałe `dark`, a klasa `dark` na `<html>` też. Przy dodaniu przełącznika trzeba zmienić oba miejsca razem, inaczej przeglądarka narysuje ciemne kontrolki natywne (kalendarz, scrollbar) na jasnej stronie. Komentarz w pliku już wspomina o przełączniku.
- **Fix**: Zostawić; przy zmianie z przełącznikiem ustawiać `color-scheme` z tej samej klasy (CSS `color-scheme` w `.dark`/`:root` już jest).
- **Decision**: SKIPPED
