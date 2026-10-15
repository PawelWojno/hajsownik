<!-- IMPL-REVIEW-REPORT -->
# Implementation Review: Dashboard design tokens

- **Plan**: context/changes/dashboard-design-tokens/plan.md
- **Scope**: Phase 1 of 5
- **Reviewed phases**: 1
- **Date**: 2026-10-15
- **Verdict**: APPROVED
- **Findings**: 0 critical 1 warnings 2 observations

## Verdicts

| Dimension | Verdict |
|-----------|---------|
| Plan Adherence | PASS |
| Scope Discipline | PASS |
| Safety & Quality | WARNING |
| Architecture | PASS |
| Pattern Consistency | PASS |
| Success Criteria | PASS |

## Findings

### F1 — Aktualizacja zależności Radix pod `vaul` nie została sprawdzona w działaniu

- **Severity**: ⚠️ WARNING
- **Impact**: 🔎 MEDIUM — real tradeoff; pause to reason through it
- **Dimension**: Safety & Quality
- **Location**: package-lock.json (`node_modules/@radix-ui/react-dialog`, `react-dismissable-layer`, `react-focus-scope`, `react-portal`, `react-presence`); src/components/month/EntrySheet.tsx:52-56
- **Detail**: Dodanie `radix-ui` podniosło w lockfile `@radix-ui/react-dialog` używany przez `vaul` z 1.2.0 do 1.3.1 (i powiązane pakiety). `Drawer` to podstawa `EntrySheet`, który ma własną obsługę „klik na zewnątrz” dla natywnego date pickera (`EntrySheet.tsx:52-56`), czyli zachowanie zależne od `dismissable-layer`. Faza 1 uruchomiła tylko lint i build, a nowe komponenty nie są jeszcze nigdzie importowane, więc żadna bramka nie ćwiczy `Drawer`.
- **Fix**: Przed fazą 3 otworzyć `EntrySheet` (wydatek i przychód) w dev serwerze po restarcie: zapis, zamknięcie X i Esc, wybór daty w „Więcej opcji”. Jeśli zachowanie się zmieniło, przypiąć wersję przez `overrides` w `package.json`.
  - Strength: Wychwytuje regresję w istniejącej funkcji, zanim faza 3 zacznie zmieniać ten sam plik.
  - Tradeoff: Kilka minut ręcznego testu.
  - Confidence: MED — potwierdzony diff wersji, ale nie wiadomo, czy zmiana dotyka używanych ścieżek.
  - Blind spot: Nie sprawdzono changeloga `@radix-ui/react-dialog` 1.2.0 → 1.3.1.
- **Decision**: FIXED — dodano krok 2.5 (ręczny test EntrySheet) do fazy 2 w plan.md

### F2 — Dwa style importu Radix w `ui/`

- **Severity**: 👁️ OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Pattern Consistency
- **Location**: src/components/ui/button.tsx:2 vs src/components/ui/select.tsx:4, src/components/ui/label.tsx:3
- **Detail**: `button.tsx` importuje `@radix-ui/react-slot`, a nowe `select.tsx` i `label.tsx` używają zbiorczego pakietu `radix-ui`. Oba pakiety są w drzewie zależności. To zgodne z aktualnym generatorem shadcn, więc nie jest błędem.
- **Fix**: Zostawić; ewentualnie przy okazji przenieść `button.tsx` na `radix-ui` w osobnej zmianie.
- **Decision**: SKIPPED

### F3 — Domyślne ustawienia `Select` i `Card` wymagają nadpisań w fazie 3

- **Severity**: 👁️ OBSERVATION
- **Impact**: 🔎 MEDIUM — real tradeoff; pause to reason through it
- **Dimension**: Architecture
- **Location**: src/components/ui/select.tsx:44-50 (`position="item-aligned"`, `SelectPrimitive.Portal`), src/components/ui/select.tsx:31 (`w-fit`), src/components/ui/card.tsx:8 (`gap-6 py-6`)
- **Detail**: To samo ryzyko stoi za otwartym punktem 1.3: lista `Select` trafia do portalu w `document.body`, poza `Drawer`, więc vaul może uznać klik w opcję za klik na zewnątrz albo zablokować go przez `pointer-events`. Dodatkowo trigger ma `w-fit` (pola w `EntrySheet` są pełnej szerokości), a `Card` ma duże domyślne `py-6`/`px-6`, które karta sum w `MonthScreen` będzie musiała nadpisać.
- **Fix**: W fazie 3 najpierw wstawić `Select` do `EntrySheet` i sprawdzić go w Playwright; w razie problemu użyć `position="popper"` albo natywnego `<select>` z tokenami (plan przewiduje taki fallback).
- **Decision**: SKIPPED
