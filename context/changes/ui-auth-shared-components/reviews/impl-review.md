<!-- IMPL-REVIEW-REPORT -->
# Implementation Review: Wspólne komponenty auth na tokenach

- **Plan**: context/changes/ui-auth-shared-components/plan.md
- **Scope**: Full plan
- **Reviewed phases**: 1, 2, 3
- **Date**: 2026-10-17
- **Verdict**: APPROVED
- **Findings**: 0 critical, 2 warnings, 2 observations

## Verdicts

| Dimension | Verdict |
|-----------|---------|
| Plan Adherence | WARNING |
| Scope Discipline | WARNING |
| Safety & Quality | PASS |
| Architecture | PASS |
| Pattern Consistency | PASS |
| Success Criteria | WARNING |

## Evidence

- Commits: 8ac5fb3 (p1), 26d9979 (p2), 877cd50 (p3), 060a779 (epilogue)
- `node scripts/check-ui-tokens.mjs` → `20 file(s) clean` ✓
- grep z `10x-ui/SKILL.md:123` na trzech komponentach + `AuthStatesDemo.tsx` → 0 trafień ✓
- `npm run lint` ✓, `npx astro check` → 0 errors/warnings/hints ✓, `npm run build` ✓
- `npm run smoke` — niepotwierdzone w tym przeglądzie (brak działającego serwera na :4321); potwierdzone osobno w Fazie 3 (preview :4399 + lokalny Supabase): „All smoke steps passed”, przed commitem 877cd50
- Poprawki z plan-review (F1 `ring-3`, F2 propsy addytywne, F3 komenda grep, F4 `font-normal`, F5 `check:ui` w Fazie 2) są w kodzie.

## Findings

### F1 — Wysokość i rozmiar tekstu pola nadpisane bez zapisu w planie

- **Severity**: ⚠️ WARNING
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Plan Adherence
- **Location**: src/components/auth/FormField.tsx:59, src/components/auth/SubmitButton.tsx:19
- **Detail**: Kontrakt Fazy 1 przyjmował domyślne `h-9` i 14 px z `ui/input` (do oceny w 1.4). Implementacja nadpisuje je na `h-10.5 md:text-base` w polu, `h-10` w przycisku i `leading-5 block` w etykiecie, czyli zachowuje dawny wygląd. Decyzja jest rozsądna (bez wartości arbitralnych, `check:ui` przechodzi), ale plan i kryterium 1.4 dalej opisują `h-9`/14 px, więc przyszły przegląd uzna to za dryf.
- **Fix**: Dopisać do Kontraktu FormField/SubmitButton jedno zdanie: „nadpisujemy `h-10.5 md:text-base` (pole) i `h-10` (przycisk), żeby zachować dotychczasową wysokość i 16 px”.
- **Decision**: FIXED

### F2 — Nieplanowany plik `AuthStatesDemo.tsx`

- **Severity**: ⚠️ WARNING
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Scope Discipline
- **Location**: src/components/dev/AuthStatesDemo.tsx:1-62
- **Detail**: Faza 2 planowała zmiany tylko w `dashboard-states.astro`. Dodano wyspę React z trzema komponentami demo, bo `.astro` nie przekaże reactowych `icon`/`endContent` (ReactNode). Plik jest w `src/components/dev` (już w `CLEAN_PATHS`), więc jest skanowany, i nie jest nową stroną dev. Uzasadnione, nieszkodliwe, ale nieudokumentowane (research, Open Question 2, wskazywał tę opcję).
- **Fix**: Dodać `AuthStatesDemo.tsx` do „Changes Required” Fazy 2 jako addendum z jednym zdaniem uzasadnienia.
- **Decision**: FIXED

### F3 — Komórka „disabled” przycisku jest identyczna z „loading”

- **Severity**: OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Success Criteria
- **Location**: src/components/dev/AuthStatesDemo.tsx:35
- **Detail**: `AuthButtonDemo state="disabled"` ustawia `pending={true}`, więc pokazuje spinner i „Loguję…”, tak samo jak stan 7. To zgodne z działaniem komponentu (`SubmitButton` wyłącza się tylko w trakcie wysyłki), ale czytelnik macierzy nie wie, że to celowe.
- **Fix**: W sekcji 4 dopisać krótką notkę „SubmitButton: disabled = pending (ten sam wygląd co loading)” albo zamienić komórkę na N/A z tym powodem.
- **Decision**: FIXED

### F4 — Zrzuty z Fazy 2 nie są w repo

- **Severity**: OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Success Criteria
- **Location**: context/changes/ui-auth-shared-components/screens-*.png
- **Detail**: Progress 2.2 wskazuje commit 26d9979, ale `screens-desktop.png` i `screens-mobile-390.png` są untracked. Poprzednia zmiana UI (`ui-home-page`) trzymała dowody w podfolderze `screens/`. Bez commita dowód zniknie przy archiwizacji/klonowaniu.
- **Fix**: Przenieść do `context/changes/ui-auth-shared-components/screens/` i zacommitować.
- **Decision**: FIXED (przeniesione do `screens/desktop.png` i `screens/mobile-390.png`; commit po stronie użytkownika)
