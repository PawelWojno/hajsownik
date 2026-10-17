# Wspólne komponenty auth na tokenach — plan wdrożenia

## Overview

Podpiąć `FormField`, `SubmitButton` i `PasswordToggle` (`src/components/auth`) pod tokeny z `src/styles/global.css` i komponenty `ui/input`, `ui/label`, `ui/button`, bez zmian łamiących w propsach (nowe propsy tylko opcjonalne). Pokazać 7 stanów w `/dev/dashboard-states` i dopisać trzy pliki do `CLEAN_PATHS`, żeby kolejny agent nie wrócił do klas palety.

## Current State Analysis

Skan hardcode daje 8 trafionych linii: `FormField.tsx` 5, `SubmitButton.tsx` 2, `PasswordToggle.tsx` 1. `FormField` ma ręczny `<input>` i `<label>`, `SubmitButton` nadpisuje `Button` kolorami `purple-600/500`, `PasswordToggle` nie ma `focus-visible`. Komponenty importują tylko 4 formularze (`ForgotPasswordForm`, `SignInForm`, `SignUpForm`, `UpdatePasswordForm`), które są poza zakresem.

## Desired End State

Trzy pliki nie mają klas palety ani wartości arbitralnych, używają `ui/*` i tokenów, a `npm run check:ui` je skanuje. Strony `/auth/*` wyglądają podobnie jak dziś (różnica tła pola w dark do oceny na zrzucie), a fokus klawiatury jest widoczny na polu i na ikonie oka. Błąd pola jest powiązany z inputem przez `aria-invalid` i `aria-describedby`.

### Key Discoveries:

- Tokeny `primary`, `primary-hover`, `ring`, `destructive`, `input`, `border`, `muted-foreground` istnieją w `:root` i `.dark` (`src/styles/global.css:15-27,68-80`): nowych tokenów nie trzeba.
- `ui/input` ma `focus-visible`, `aria-invalid` i `disabled` (`src/components/ui/input.tsx:10-13`); `ui/button` wariant `default` ma `bg-primary hover:bg-primary-hover` (`button.tsx:15`).
- Demo używa dla pól na ciemnym tle `dark:bg-card` (`src/pages/dev/dashboard-states.astro:134,152,170`): ten sam wzorzec dla `FormField`.
- `SubmitButton` bierze `pending` z `useFormStatus()` (`SubmitButton.tsx:12`), więc na stronie statycznej loading wymaga propa.
- `hint` jest używany tylko w `SignUpForm.tsx:105`.

## What We're NOT Doing

- Nie zmieniamy `*Form.tsx` ani stron `src/pages/auth/*`.
- Nie dodajemy tokenów ani nie zmieniamy `global.css`.
- Nie migrujemy `settings/RecurringManager.tsx` i `RecurringIncomeManager.tsx` (kopie starego wyglądu): odroczone, osobny widok.
- Nie wiążemy `hint` z `aria-describedby` (markup `hint` należy do formularza).
- Nie dodajemy testów zrzutów ekranu ani nowej strony dev.

## Implementation Approach

Najpierw komponenty (zmiana wyglądu, ten sam interfejs), potem dowody wizualne w istniejącej stronie dev, na końcu bramka `CLEAN_PATHS` i pełne bramki repo. Dopisanie do `CLEAN_PATHS` dopiero po zielonym skanie, żeby hook pre-commit nie blokował pośrednich commitów.

## Faza 1: Komponenty na tokenach i komponentach ui

### Overview

Podmiana klas palety na tokeny i `ui/*` w trzech plikach, plus `aria` i prop `pending`.

### Changes Required:

#### 1. FormField

**File**: `src/components/auth/FormField.tsx`

**Intent**: Użyć `ui/input` i `ui/label` zamiast ręcznego `<input>`/`<label>`, wszystkie kolory z tokenów, błąd powiązany z polem.

**Contract**: Interfejs `FormFieldProps` rośnie addytywnie o opcjonalne `disabled?: boolean` i `inputClassName?: string` (przekazywane do `Input`, łączone przez `cn`); formularze ich nie przekazują. `Input` dostaje `className` z `pl-10` i `dark:bg-card`, `aria-invalid={Boolean(error)}` oraz `aria-describedby="<id>-error"` tylko przy błędzie. `Label` zachowuje odstęp `mb-1` i `text-muted-foreground`, plus `font-normal` (domyślny `font-medium leading-none` z `ui/label` pogrubiłby etykietę); ikona `text-muted-foreground`; `<p>` błędu dostaje `id="<id>-error"` i `text-destructive`. Wywalić `inputBase`.

#### 2. SubmitButton

**File**: `src/components/auth/SubmitButton.tsx`

**Intent**: Zostawić kolory i hover wariantowi `default` z `ui/button`, spinner na tokenach, dodać możliwość wymuszenia loading w demo.

**Contract**: Dodać opcjonalny `pending?: boolean`, który nadpisuje wartość z `useFormStatus()`; `className="w-full"` bez klas koloru. Spinner `border-primary-foreground/30 border-t-primary-foreground`. Dodać też opcjonalne `className?: string` (łączone przez `cn` z `w-full`), żeby demo mogło wymusić hover. Formularze nie przekazują nowych propów.

#### 3. PasswordToggle

**File**: `src/components/auth/PasswordToggle.tsx`

**Intent**: Dodać widoczny fokus klawiatury i tokenowe kolory.

**Contract**: `text-muted-foreground hover:text-foreground`, `rounded outline-none focus-visible:ring-3 focus-visible:ring-ring/50` (`ring-3`, bo regex `check:ui` blokuje `ring-[3px]`; jak `Topbar.astro:26`); pozycjonowanie bez zmian.

### Success Criteria:

#### Automated Verification:

- Skan hardcode na trzech plikach zwraca 0 trafień: komenda grep z `.claude/skills/10x-ui/SKILL.md:123` uruchomiona na `src/components/auth/{FormField,SubmitButton,PasswordToggle}.tsx`. Uwaga: `check-ui-tokens.mjs <plik>` przed Fazą 3 pomija pliki spoza `CLEAN_PATHS` i daje fałszywy pass
- Linting passes: `npm run lint`
- Type checking passes: `npx astro check`

#### Manual Verification:

- `/auth/signin` i `/auth/signup` wyglądają poprawnie (wysokość pola `h-9` i tekst 14 px na desktopie, waga etykiety), błąd walidacji podświetla pole i pokazuje komunikat
- Tab: fokus widoczny na polu i na ikonie oka

**Implementation Note**: Po fazie zatrzymaj się na ręczne potwierdzenie.

---

## Faza 2: Demo 7 stanów i zrzuty

### Overview

Dowód wizualny w istniejącej stronie `/dev/dashboard-states`, bez nowej strony.

### Changes Required:

#### 1. Sekcje stanów

**File**: `src/pages/dev/dashboard-states.astro`

**Intent**: Dodać do istniejących sekcji 1-7 kontrolki auth: `FormField` (default, focus wymuszony, disabled, error), `SubmitButton` (default, hover, disabled, loading przez `pending`), `PasswordToggle` (focus wymuszony).

**Contract**: Statyczny render bez hydracji, wymuszone stany klasami jak `forcedFocus` (linia 56). Stan empty oznaczyć N/A z powodem (formularz nie ma stanu pustych danych) w akapicie N/A (linie 68-71).

### Success Criteria:

#### Automated Verification:

- Strona dev buduje się i lintuje: `npm run lint` i `npx astro check`
- `npm run check:ui` przechodzi (strona dev jest już w `CLEAN_PATHS`)

#### Manual Verification:

- Zrzuty desktop i 390 px: wszystkie 7 komórek pokazane lub N/A z powodem
- Tło pola w dark (`dark:bg-card`) akceptowalne wobec dotychczasowego `bg-white/10`
- Prawdziwy hover i Tab sprawdzone na `/auth/signin`

**Implementation Note**: Po fazie zatrzymaj się na ręczne potwierdzenie zrzutów.

---

## Faza 3: Zabezpieczenie i bramki

### Overview

Dopisać pliki do skanu `check:ui` i uruchomić pełne bramki.

### Changes Required:

#### 1. CLEAN_PATHS

**File**: `scripts/check-ui-tokens.mjs`

**Intent**: Pilnować trzech plików przed regresją do klas palety.

**Contract**: Dopisać `src/components/auth/FormField.tsx`, `SubmitButton.tsx`, `PasswordToggle.tsx` do `CLEAN_PATHS` (obok istniejącego `ServerError.tsx`). Reguły w `CLAUDE.md` bez zmian, jeśli już pokrywają ten przypadek.

### Success Criteria:

#### Automated Verification:

- `npm run check:ui` przechodzi
- Linting passes: `npm run lint`
- Type checking passes: `npx astro check`
- Production build: `npm run build`
- Smoke test auth: `npm run smoke` (przy działającym serwerze)

#### Manual Verification:

- Wstawienie `bg-purple-600` do `FormField.tsx` powoduje błąd `check:ui` (po sprawdzeniu cofnąć)

**Implementation Note**: Ostatnia faza, potem `/10x-impl-review`.

---

## Testing Strategy

### Unit Tests:

- Brak runnera testów jednostkowych dla UI w repo; polegamy na bramkach i dowodach wizualnych.

### Manual Testing Steps:

1. `/auth/signin`: pusty submit pokazuje błędy pól, Tab przechodzi pole → oko → przycisk z widocznym fokusem.
2. `/auth/signup`: pole hasła z `hint`, dwa pola z okiem.
3. `/dev/dashboard-states` na desktopie i 390 px (Playwright, zrzuty).

## Performance Considerations

Brak.

## Migration Notes

Po `npm run build` serwer dev trzeba zrestartować i odświeżyć stronę twardo (wyspy React).

## References

- Related research: `context/changes/ui-auth-shared-components/research.md`
- Wzorzec tokenowy: `src/components/auth/ServerError.tsx`
- Demo stanów: `src/pages/dev/dashboard-states.astro:134,152,170`

## Progress

> Convention: `- [ ]` pending, `- [x]` done. Append ` — <commit sha>` when a step lands. Do not rename step titles. See `references/progress-format.md`.

### Phase 1: Komponenty na tokenach i komponentach ui

#### Automated

- [x] 1.1 Skan hardcode (grep z 10x-ui SKILL.md:123) na trzech plikach zwraca 0 trafień — 8ac5fb3
- [x] 1.2 Linting passes: `npm run lint` — 8ac5fb3
- [x] 1.3 Type checking passes: `npx astro check` — 8ac5fb3

#### Manual

- [x] 1.4 `/auth/signin` i `/auth/signup` wyglądają poprawnie (wysokość pola, tekst 14 px, waga etykiety), błąd walidacji podświetla pole i pokazuje komunikat — 8ac5fb3
- [x] 1.5 Tab: fokus widoczny na polu i na ikonie oka — 8ac5fb3

### Phase 2: Demo 7 stanów i zrzuty

#### Automated

- [x] 2.1 Strona dev buduje się i lintuje: `npm run lint` i `npx astro check`
- [x] 2.5 `npm run check:ui` przechodzi (strona dev jest już w `CLEAN_PATHS`)

#### Manual

- [x] 2.2 Zrzuty desktop i 390 px: wszystkie 7 komórek pokazane lub N/A z powodem
- [x] 2.3 Tło pola w dark (`dark:bg-card`) akceptowalne wobec dotychczasowego `bg-white/10`
- [x] 2.4 Prawdziwy hover i Tab sprawdzone na `/auth/signin`

### Phase 3: Zabezpieczenie i bramki

#### Automated

- [ ] 3.1 `npm run check:ui` przechodzi
- [ ] 3.2 Linting passes: `npm run lint`
- [ ] 3.3 Type checking passes: `npx astro check`
- [ ] 3.4 Production build: `npm run build`
- [ ] 3.5 Smoke test auth: `npm run smoke` (przy działającym serwerze)

#### Manual

- [ ] 3.6 Wstawienie `bg-purple-600` do `FormField.tsx` powoduje błąd `check:ui` (po sprawdzeniu cofnąć)
