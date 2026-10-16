<!-- IMPL-REVIEW-REPORT -->
# Implementation Review: Strona główna na tokenach stylów

- **Plan**: context/changes/home-design-tokens/plan.md
- **Scope**: Full plan (phases 1–3 of 3)
- **Reviewed phases**: 1, 2, 3
- **Date**: 2026-10-16
- **Verdict**: APPROVED
- **Findings**: 0 critical, 0 warnings, 1 observation

## Verdicts

| Dimension | Verdict |
|-----------|---------|
| Plan Adherence | PASS |
| Scope Discipline | PASS |
| Safety & Quality | PASS |
| Architecture | PASS |
| Pattern Consistency | PASS |
| Success Criteria | PASS |

## Evidence

- Zakres z gita (`6d0ebdf..059f1f4`, 4 commity): kod to `src/components/Welcome.astro` i `scripts/check-ui-tokens.mjs`; reszta to folder zmiany (change, research, plan, brief, plan-review, 2 skrypty Playwright, `home-before-focus.txt`, 10 zrzutów PNG). `index.astro` bez zmian, zgodnie z planem.
- `Welcome.astro`: orby i pole gwiazd usunięte (`rg`: 0 elementów z `blur-[` i `radial-gradient`), tytuł `from-title-from to-title-to`, tekst i ikony z tokenów, CTA przez `cn(buttonVariants(...), cta)` z `shadow-none` (wynik F3 z plan-review), karty z tablicy `features` przez `ui/card` (`Welcome.astro:57-78`). Zgodne z kontraktem fazy 2.
- `check-ui-tokens.mjs`: `src/pages/index.astro` i `src/components/Welcome.astro` dopisane do `CLEAN_PATHS` (zgodnie z fazą 3); `npm run check:ui` = 12 plików czystych.
- Poza „What We're NOT Doing": brak zmian w `global.css`, `Topbar`, innych widokach i zależnościach.
- Bramki ponownie uruchomione na HEAD: lint ✅, check:ui ✅ (12 plików), astro check ✅ (0/0/0), build ✅, skan wartości ✅ (0 trafień), smoke ✅. Skrypt Playwright „po" (10/10) uruchamiany w fazie 3; nie powtarzany w przeglądzie.
- Punkty ręczne 1.3, 2.3, 3.5, 3.6 odhaczone po potwierdzeniu użytkownika; dowody w `screenshots/` (zrzuty przed/po i stanów fokusu).
- Dodatki poza listą planu (nieszkodliwe): `home-before-focus-*.png` i `home-after-focus-secondary-*.png` (zrzuty fokusu pomocnicze do 3.6).
- Reguły `lessons.md`: „`:root` razem z `.dark`" nie dotyczy (brak nowych tokenów).

## Findings

### F1 — Plan opisuje `set:html` i `class={...}`, a kod robi to inaczej

- **Severity**: 🔍 OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Plan Adherence
- **Location**: plan.md, Phase 2 — Changes Required, pkt 2 i 3; `Welcome.astro:10-13,46-49,71-73`
- **Detail**: W trakcie fazy 2 dwa szczegóły zmieniły się względem kontraktu (zgłoszone w rozmowie jako `ADAPT`, ale nie w planie): ikony kart są renderowane jako `<path d=...>` z tablicy zamiast przez `set:html` (reguła ESLint `astro/no-set-html-directive`), a klasy CTA są obliczane we frontmatter i podawane jako `class:list={[primaryCta]}` zamiast `class={cn(...)}` (reguła `astro/prefer-class-list-directive`). Intencja planu jest zachowana, ale plan, który trafi do archiwum, nie odpowiada kodowi.
- **Fix**: Dopisać w `plan.md` (Phase 2, pkt 2 i 3) jednozdaniową notę o adaptacji (path data zamiast `set:html`, `class:list` z gotowym stringiem) przed archiwizacją.
- **Decision**: FIXED (Fix now: noty o adaptacji dopisane w Phase 2 pkt 2 i 3 w `plan.md`)
