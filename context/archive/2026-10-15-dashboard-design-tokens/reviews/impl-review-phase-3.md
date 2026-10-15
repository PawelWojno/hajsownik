<!-- IMPL-REVIEW-REPORT -->
# Implementation Review: Dashboard design tokens

- **Plan**: context/changes/dashboard-design-tokens/plan.md
- **Scope**: Phase 3 of 5
- **Reviewed phases**: 3
- **Date**: 2026-10-15
- **Verdict**: APPROVED
- **Findings**: 0 critical 1 warnings 2 observations

## Verdicts

| Dimension | Verdict |
|-----------|---------|
| Plan Adherence | WARNING |
| Scope Discipline | PASS |
| Safety & Quality | PASS |
| Architecture | PASS |
| Pattern Consistency | PASS |
| Success Criteria | PASS |

## Findings

### F1 — Zmiany poza listą plików fazy 3 nie są zapisane w planie

- **Severity**: ⚠️ WARNING
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Plan Adherence
- **Location**: src/styles/global.css (`--link`, `--link-hover`, `.dark --accent`), src/components/ui/button.tsx:18
- **Detail**: Faza 3 zmieniła dwa pliki spoza swojej listy: nowe tokeny `--link`/`--link-hover`, `--accent` w `.dark` na 10% bieli i wariant `ghost` w `button.tsx` (`dark:hover:bg-accent` zamiast `/50`). Decyzje zapadły z użytkownikiem po porównaniu screenów i są w `tokens.md` oraz w treści commitu, ale `plan.md` (sekcja fazy 3) ich nie wymienia. Przegląd całości i archiwum traktują plan jako źródło prawdy, więc wyglądałyby jak nieplanowany zakres. `--accent` wpływa też na przyciski `ghost` w history i settings (użytkownik obejrzał je i zaakceptował).
- **Fix**: Dopisać do fazy 3 w `plan.md` krótki addendum z tymi trzema zmianami i powodem (screeny przed/po, decyzja „robimy globalnie”).
- **Decision**: FIXED — addendum do fazy 3 w plan.md

### F2 — Najechanie na główny przycisk przyciemnia zamiast rozjaśniać

- **Severity**: 👁️ OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Pattern Consistency
- **Location**: src/components/ui/button.tsx:13 (`default`: `hover:bg-primary/90`), src/components/month/MonthScreen.tsx:77, EntrySheet.tsx (przycisk „Zapisz”)
- **Detail**: Przed zmianą fioletowe przyciski miały `hover:bg-purple-500` (jaśniejszy fiolet). Teraz używają domyślnego `hover:bg-primary/90`, czyli 90% krycia na ciemnym tle, więc po najechaniu robią się odrobinę ciemniejsze. Efekt jest subtelny i nie był częścią porównania screenów (stan hover głównego przycisku nie był fotografowany).
- **Fix**: Zostawić (standard shadcn) albo w fazie 4 sprawdzić hover na kitchen-sink i w razie potrzeby dodać token `--primary-hover`.
- **Decision**: FIXED — token --primary-hover i hover:bg-primary-hover w wariancie default

### F3 — Kafelek kategorii używa tokenu ramki pola jako tła po najechaniu

- **Severity**: 👁️ OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Pattern Consistency
- **Location**: src/components/month/CategoryGrid.tsx:28 (`hover:bg-input`)
- **Detail**: `--input` to rola „ramka pola”, a tu służy jako tło najechania (20% bieli, dokładnie jak dawne `hover:bg-white/20`). Wizualnie poprawne, ale znaczeniowo mylące: kolejny agent może kopiować `bg-input` jako ogólne „jaśniejsze tło”. Zamiana na `bg-accent` nie zadziała, bo kafelek ma już `bg-card` (10%), a `--accent` też ma 10%, więc najechanie byłoby niewidoczne.
- **Fix**: Zostawić; jeśli kolejne widoki będą potrzebować „mocniejszego najechania”, dodać wtedy osobny token.
- **Decision**: SKIPPED
