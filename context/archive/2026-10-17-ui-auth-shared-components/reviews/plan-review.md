<!-- PLAN-REVIEW-REPORT -->
# Plan Review: Wspólne komponenty auth na tokenach

- **Plan**: context/changes/ui-auth-shared-components/plan.md
- **Mode**: Deep
- **Date**: 2026-10-17
- **Verdict**: REVISE
- **Findings**: 1 critical, 2 warnings, 2 observations

## Verdicts

| Dimension | Verdict |
|-----------|---------|
| End-State Alignment | PASS |
| Lean Execution | PASS |
| Architectural Fitness | FAIL |
| Blind Spots | WARNING |
| Plan Completeness | WARNING |

## Grounding

5/5 paths ✓, 4/4 symbols ✓ (`forcedFocus` dashboard-states:56, `useFormStatus` SubmitButton:12, `hint` SignUpForm:105, `dark:bg-card` dashboard-states:134,152,170), brief↔plan ✓, Progress↔Phase ✓

## Findings

### F1 — `ring-[3px]` w PasswordToggle oblewa check:ui

- **Severity**: ❌ CRITICAL
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Architectural Fitness
- **Location**: Faza 1 §3 PasswordToggle (Contract)
- **Detail**: Kontrakt każe `focus-visible:ring-[3px]`. Regex w `scripts/check-ui-tokens.mjs:27` zawiera `-\[[0-9.]+(px|rem)\]`, więc linia będzie trafieniem: kryteria 1.1 i 3.1 oblewają, a po dopisaniu pliku do `CLEAN_PATHS` hook pre-commit blokuje commit. Klasa skopiowana z `ui/input.tsx:11`, ale `ui/*` nie jest w `CLEAN_PATHS`. Wszystkie czyste widoki używają `ring-3` (`Topbar.astro:26`, `Welcome.astro:14`, `EntrySheet.tsx:255`, `dashboard-states.astro:56`).
- **Fix**: Zmienić na `outline-none focus-visible:ring-3 focus-visible:ring-ring/50` (jak `Topbar.astro:26`).
- **Decision**: FIXED (Fix in plan)

### F2 — Demo wymaga propsów, których komponenty nie mają

- **Severity**: ⚠️ WARNING
- **Impact**: 🔎 MEDIUM — real tradeoff; pause to reason through it
- **Dimension**: Plan Completeness
- **Location**: Faza 1 §1–2 (Contract) vs Faza 2 §1
- **Detail**: Faza 2 pokazuje `FormField` „focus wymuszony, disabled” i `SubmitButton` „hover”, ale Faza 1 mówi „Interfejs `FormFieldProps` bez zmian” i dodaje do `SubmitButton` tylko `pending`. `FormField` nie ma `disabled` ani `className`, a `SubmitButton` nie ma `className`, więc wymuszonych klas ani atrybutu `disabled` nie da się przekazać do wewnętrznego `Input`/`Button`. Do tego CLAUDE.md wymaga stanu „disabled (a real `disabled` attribute)” dla każdego elementu interaktywnego, a `FormField` dziś w ogóle nie da się wyłączyć. Implementator będzie musiał zgadywać: rozszerzyć interfejs czy wyciąć komórki demo.
- **Fix A ⭐ Recommended**: Addytywne opcjonalne propsy: `FormField` dostaje `disabled?: boolean` i `inputClassName?: string` (przekazane do `Input`), `SubmitButton` dostaje `className?: string` (łączony przez `cn`). Formularze ich nie przekazują.
  - Strength: Demo pokazuje prawdziwy komponent we wszystkich stanach, a `FormField` zaczyna spełniać regułę disabled z CLAUDE.md.
  - Tradeoff: Interfejs rośnie, więc „bez zmiany propsów” w Overview i Desired End State trzeba zmienić na „bez zmian łamiących”.
  - Confidence: HIGH — propsy są opcjonalne, a 4 formularze (jedyni konsumenci według grepa) się nie zmieniają.
  - Blind spot: None significant.
- **Fix B**: Zawęzić demo zamiast interfejsu: wymuszony focus i disabled pola zostają na istniejącym surowym `ui/Input` (dashboard-states:134,152), `FormField` pokazuje tylko default i error, a hover `SubmitButton` dostaje N/A z powodem.
  - Strength: Interfejs naprawdę bez zmian, mniejsza zmiana.
  - Tradeoff: `FormField` dalej nie ma stanu disabled (reguła CLAUDE.md niespełniona), a demo nie dowodzi wyglądu kompozycji auth (ikona + `pl-10` + ring).
  - Confidence: MED — luka widoczna dopiero przy ręcznym Tab.
  - Blind spot: Czy formularze kiedyś będą musiały blokować pola w trakcie submitu.
- **Decision**: FIXED (Fix A)

### F3 — Kryterium 1.1 bez uruchamialnej komendy, a oczywista komenda daje fałszywy pass

- **Severity**: ⚠️ WARNING
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Plan Completeness
- **Location**: Faza 1, Automated Verification (1.1)
- **Detail**: „Komenda ze skilla 10x-ui” to nie jest komenda. Kusząca alternatywa `node scripts/check-ui-tokens.mjs src/components/auth/FormField.tsx` po cichu pomija pliki spoza `CLEAN_PATHS` (`check-ui-tokens.mjs:41`) i wypisuje „0 file(s) clean”, czyli daje fałszywy pass w Fazie 1, bo pliki trafiają do `CLEAN_PATHS` dopiero w Fazie 3.
- **Fix**: Wkleić do 1.1 grep z `.claude/skills/10x-ui/SKILL.md:123` z trzema ścieżkami i dopisać, że `check-ui-tokens.mjs` z argumentem nie działa przed Fazą 3.
- **Decision**: FIXED (Fix in plan)

### F4 — Domyślne style `ui/*` zmieniają wygląd i nie ma ich w kontrakcie

- **Severity**: OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Blind Spots
- **Location**: Faza 1 §1 FormField (Contract)
- **Detail**: `ui/label` dokłada `font-medium leading-none` (`label.tsx:10`), więc etykieta zrobi się grubsza niż dziś. Demo już to neutralizuje przez `font-normal` (dashboard-states:131). `ui/input` ma `h-9 py-1 md:text-sm`, więc na desktopie pole jest niższe, a tekst ma 14 px zamiast 16 px (dziś: `py-2`, dziedziczony rozmiar). Brief wymienia tylko `h-9` przycisku.
- **Fix**: Dodać `font-normal` do `Label` w kontrakcie, a wysokość i rozmiar tekstu pola dopisać do ręcznego sprawdzenia 1.4 i do ryzyk w briefie.
- **Decision**: FIXED (Fix in plan)

### F5 — Faza 2 nie uruchamia check:ui, choć strona dev jest w CLEAN_PATHS

- **Severity**: OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Plan Completeness
- **Location**: Faza 2, Automated Verification
- **Detail**: `dashboard-states.astro` jest już skanowany (`check-ui-tokens.mjs:15`), więc wymuszona klasa hover/focus z wartością arbitralną wyjdzie dopiero w hooku pre-commit.
- **Fix**: Dodać `- npm run check:ui` do kryteriów Fazy 2 i `- [ ] 2.2 ...` do Progress (z przenumerowaniem kolejnych pozycji).
- **Decision**: FIXED (Fix in plan; nowy wiersz 2.5 zamiast przenumerowania, bo indeksy Progress się nie zmieniają)
