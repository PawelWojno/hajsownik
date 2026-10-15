# Dashboard design tokens Implementation Plan

## Overview

Dashboard (`dashboard.astro`, `Topbar`, `components/month/*`) przestaje używać klas palety i hexów, a zaczyna czytać tokeny z `src/styles/global.css` i komponenty z `src/components/ui/`. Wygląd się nie zmienia (ciemny, fioletowy akcent). Zmiana zostawia regułę i kontrolę, żeby kolejny agent nie wrócił do literałów.

## Current State Analysis

- Tokeny shadcn w `global.css:5-97` są kompletne, ale martwe: widok używa `purple-*`, `blue-100/*`, `slate-900`, `white/5..20` (54 trafienia skanu hardcodów w 7 plikach).
- `.dark` nie jest nigdzie nakładane; obowiązuje jasne `:root`, a ciemny wygląd dają `bg-cosmic` (`global.css:113-115`, 3 hexy) i klasy literalne.
- `ui/` ma tylko `button.tsx` i `drawer.tsx`; pola formularza to `fieldClass` (`EntrySheet.tsx:24`), a `Button` jest nadpisywany klasami purple.
- Pełny audyt i zarzuty C1–C4: `research.md` (sekcja `## Charges`).

## Desired End State

Dashboard wygląda jak dziś, ale: skan hardcodów na 7 plikach widoku zwraca 0, pola używają `Input`/`Select`/`Label`, karta sum używa `Card`, każda kontrolka ma widoczny fokus z tokenu `--ring`, `<html class="dark">` aktywuje ciemne wartości z `.dark`, a jasne `:root` czeka na przyszły przełącznik. Skrypt `check:ui` pilnuje oczyszczonych plików.

### Key Discoveries:

- `@theme inline` już publikuje `--color-*`, więc wystarczy zmienić wartości (`global.css:67-97`).
- `Drawer` używa `bg-background` (`ui/drawer.tsx:41`), dlatego `EntrySheet.tsx:51` musi go nadpisywać `bg-slate-900`.
- Brak fokusu na „Wyloguj” (`Topbar.astro:101`) i „Więcej opcji” (`EntrySheet.tsx:245`).
- ESLint (`eslint.config.js`) ma tylko plugin `react`, bez reguły na klasy palety; `lint-staged` w `package.json:59-66`.
- `--primary` jest globalny: `Button` poza zakresem (history, settings, auth) nadpisuje purple, więc fioletowy `--primary` je ujednolici.

## What We're NOT Doing

- Innych widoków (history, settings, auth), `Banner.astro` (hexy w `<style>`), przełącznika motywu, nowej palety/redesignu, `shadcn init`.
- Dopracowania jasnych wartości `:root` poza tym, co potrzebne, by jasne tokeny były sensowne (kontrast sprawdzimy przy zmianie z przełącznikiem).
- Nowej zależności lint ani runnera testów zrzutów.

## Implementation Approach

Kolejność z `/10x-ui`: komponenty → wartości tokenów → widok → stany → zabezpieczenie. Decyzje: ciemne wartości w `.dark` z `<html class="dark">` na stałe (zgodnie z docelowym jasnym motywem domyślnym i przełącznikiem), `--primary` jako obecny fiolet, gradient tytułu przez tokeny `--title-from`/`--title-to`, kontrola jako skrypt Node bez zależności (jak `scripts/smoke.mjs`).

## Phase 1: Komponenty `ui/`

### Overview

Dodać brakujące prymitywy ścieżką stosu, tylko te używane w widoku.

### Changes Required:

#### 1. Nowe komponenty shadcn

**File**: `src/components/ui/{input,select,card,label}.tsx`

**Intent**: dodać komponenty zamiast pisać je od zera; bez zmian w widoku.

**Contract**: `npx shadcn@latest add input select card label` (`components.json`: new-york, alias `@/components/ui`). Sprawdzić, czy `select` (Radix) działa w wyspie React z `client:load` i w `Drawer`; jeśli nie, zostawić natywny `<select>` ostylowany tokenami w `ui/select.tsx`.

### Success Criteria:

#### Automated Verification:

- Lint i build przechodzą: `npm run lint && npm run build`
- Pliki `ui/input.tsx`, `ui/select.tsx`, `ui/card.tsx`, `ui/label.tsx` istnieją

#### Manual Verification:

- Select działa w wyspie React i w Drawer (albo decyzja o natywnym fallbacku)

**Implementation Note**: After completing this phase and all automated verification passes, pause here for manual confirmation from the human that the manual testing was successful before proceeding to the next phase. Phase blocks use plain bullets — the corresponding `- [ ]` checkboxes for these items live in the `## Progress` section at the bottom of the plan.

---

## Phase 2: Wartości tokenów

### Overview

Ustawić wartości tokenów tak, by `.dark` odtwarzało dzisiejszy wygląd, a nowe role miały swoje tokeny.

### Changes Required:

#### 1. Warstwa tokenów

**File**: `src/styles/global.css`

**Intent**: przenieść dzisiejsze kolory widoku do tokenów w `:root` i `.dark`, publikując nowe w `@theme inline`.

**Contract**:

- `--primary` (+ `--primary-foreground`) = oklch odpowiadające `purple-600`; `--card`/`--popover` = powierzchnie dzisiejszego `white/10` i `slate-900`; `--border`, `--input`, `--muted-foreground` (zastępuje `blue-100/70..90`), `--ring` (fiolet jak `purple-400`).
- Nowe tokeny z parą `-foreground`: `--success` (kwota dodatnia, dziś `emerald-300`), `--warning` (przypomnienia, dziś `amber-*`); `--title-from`, `--title-to` (gradient tytułu); tokeny tła strony zastępujące 3 hexy w `@utility bg-cosmic`.
- `color-scheme: dark` dla `.dark` w CSS (zastępuje klasy `[color-scheme:dark]`).
- Linia „źródło” obok edytowanego bloku; surowe wartości w `context/changes/dashboard-design-tokens/tokens.md`.

#### 2. Aktywacja ciemnych wartości

**File**: `src/layouts/Layout.astro`

**Intent**: nałożyć `.dark` na stałe do czasu przełącznika.

**Contract**: `<html lang="pl" class="dark">`; zaktualizować komentarz przy `<meta name="color-scheme">`.

### Success Criteria:

#### Automated Verification:

- Build i typy przechodzą: `npm run build && npx astro check`
- `global.css` nie zawiera hexów poza blokiem wartości tokenów (skan)

#### Manual Verification:

- Dashboard wygląda jak przed zmianą (ciemny, fioletowy akcent), Drawer ciemny bez nadpisań
- Zrzuty auth/settings/history bez regresji po zmianie `--primary`
- EntrySheet po podbiciu Radix pod vaul: zapis, zamknięcie X i Esc, wybór daty nie zamyka panelu

**Implementation Note**: After completing this phase and all automated verification passes, pause here for manual confirmation from the human that the manual testing was successful before proceeding to the next phase. Phase blocks use plain bullets — the corresponding `- [ ]` checkboxes for these items live in the `## Progress` section at the bottom of the plan.

---

## Phase 3: Widok dashboard

### Overview

Zastąpić literały tokenami i komponentami (C1, C2).

### Changes Required:

#### 1. Podmiana klas na tokeny

**File**: `src/pages/dashboard.astro`, `src/components/Topbar.astro`, `src/components/month/{MonthScreen,CategoryGrid,EntrySheet,RecurringReminders,RecurringIncomeReminders}.tsx`, `src/components/auth/ServerError.tsx`

**Intent**: klasy palety → role (`bg-primary`, `text-primary-foreground`, `bg-card`, `border-border`, `text-muted-foreground`, `text-success`, `warning`, `destructive`); gradient tytułu z `--title-*`.

**Contract**: pozycje z `research.md` (C1); `ServerError` jest współdzielony z auth, więc zmiana `destructive` obejmie też auth (oczekiwane, sprawdzić zrzutem).

#### 2. Komponenty zamiast klas

**File**: `src/components/month/EntrySheet.tsx`, `src/components/month/MonthScreen.tsx`, `src/components/Topbar.astro`

**Intent**: `fieldClass` → `Input`/`Select`/`Label` (6 pól i 2 selecty, w obu formularzach); karta sum → `Card`; `Button` bez nadpisań koloru; fokus `focus-visible:ring-ring/50` na „Wyloguj” i „Więcej opcji”.

**Contract**: zachować `data-category-ids`, `aria-*` i `id` pól (smoke test i dostępność); usunąć `focus:ring-purple-400` (komponent `Input` ma `focus-visible`). Do `Input` i `Select` przekazać `className="dark:bg-card"`, bo domyślne `dark:bg-input/30` daje ok. 6% bieli zamiast dzisiejszych 10% (impl-review fazy 2, F1).

#### Addendum (decyzje po porównaniu screenów; impl-review fazy 3, F1 i F2)

**File**: `src/styles/global.css`, `src/components/ui/button.tsx`, `context/changes/dashboard-design-tokens/tokens.md`

**Intent**: przywrócić wygląd sprzed zmiany tam, gdzie domyślne wartości startera shadcn go zmieniały.

**Contract**: tokeny `--link`/`--link-hover` (dawne `purple-300`/`purple-100`: linki, menu, „Wyloguj”, „Dodaj przychód”, „Więcej opcji”); `--accent` w `.dark` = `oklch(1 0 0 / 10%)` (dawne `hover:bg-white/10`) i wariant `ghost` z `dark:hover:bg-accent` zamiast `/50`; token `--primary-hover` (dawne `hover:bg-purple-500`) i wariant `default` z `hover:bg-primary-hover` zamiast `hover:bg-primary/90`. `--accent` i oba warianty `Button` są globalne, więc dotyczą też widoków poza dashboardem (history i settings obejrzane po zmianie `--accent`).

### Success Criteria:

#### Automated Verification:

- Skan hardcodów na 7 plikach widoku zwraca 0 trafień
- Lint, typy i build przechodzą: `npm run lint && npx astro check && npm run build`
- Smoke test przechodzi: `npm run smoke`

#### Manual Verification:

- Zrzuty desktop i 390 px zgodne z wyglądem sprzed zmiany
- Fokus klawiatury widoczny na każdej kontrolce, w tym „Wyloguj” i „Więcej opcji”

**Implementation Note**: After completing this phase and all automated verification passes, pause here for manual confirmation from the human that the manual testing was successful before proceeding to the next phase. Phase blocks use plain bullets — the corresponding `- [ ]` checkboxes for these items live in the `## Progress` section at the bottom of the plan.

---

## Phase 4: Stany i bramka wizualna

### Overview

Pokazać wszystkie komórki 7-stanowej macierzy naraz (kitchen sink) jako dowód do przeglądu.

### Changes Required:

#### 1. Strona kitchen-sink (tylko dev)

**File**: `src/pages/dev/dashboard-states.astro`

**Intent**: renderuje widok we wszystkich stanach obok siebie.

**Contract**: 404 poza `import.meta.env.DEV`; poza `PROTECTED_ROUTES`, bez danych z bazy. Stany: default, hover/focus-visible (klasy wymuszone lub kroki manualne), disabled (`Button disabled`, `pending`), error (`ServerError`, blok błędu dashboardu), empty (sumy 0, brak kategorii), loading (`pending` = „Zapisuję…”); komórka bez sensu = N/A z powodem. Zrzuty Playwright, desktop + 390 px, zapisane w folderze zmiany.

### Success Criteria:

#### Automated Verification:

- Kitchen-sink zwraca 404 w buildzie produkcyjnym (`npm run preview`)

#### Manual Verification:

- 7-stanowa macierz: każda komórka pokazana lub N/A z powodem
- Zrzuty kitchen-sink desktop i 390 px zapisane w folderze zmiany

**Implementation Note**: After completing this phase and all automated verification passes, pause here for manual confirmation from the human that the manual testing was successful before proceeding to the next phase. Phase blocks use plain bullets — the corresponding `- [ ]` checkboxes for these items live in the `## Progress` section at the bottom of the plan.

---

## Phase 5: Zabezpieczenie

### Overview

Kolejny agent trzyma się kontraktu (C4).

### Changes Required:

#### 1. Reguła agenta

**File**: `CLAUDE.md`

**Intent**: krótki blok UI poza blokiem `@przeprogramowani/10x-cli`: gdzie tokeny, gdzie komponenty (`npx shadcn@latest add`), zakaz literałów, link do kitchen-sink.

**Contract**: rozszerzyć istniejącą sekcję `## UI`, nie tworzyć drugiej; potwierdzić, że żadna reguła nie zachęca do wartości jednorazowych.

#### 2. Kontrola

**File**: `scripts/check-ui-tokens.mjs`, `package.json`

**Intent**: nieudana kontrola zamiast reguły, o której agent zapomniał.

**Contract**: skrypt bez zależności, regex skanu z `/10x-ui`, argumenty = pliki, exit 1 przy trafieniu; skrypt `check:ui` i wpis w `lint-staged` ograniczony do oczyszczonych plików (nie globalnie, bo pozostałe widoki jeszcze trafiają).

### Success Criteria:

#### Automated Verification:

- `node scripts/check-ui-tokens.mjs` na 7 plikach widoku zwraca 0
- Skrypt zwraca 1 na pliku testowym z `bg-purple-600`
- `lint-staged` uruchamia kontrolę dla oczyszczonych plików

#### Manual Verification:

- Blok UI w `CLAUDE.md` poza blokiem zarządzanym przez CLI

---

## Testing Strategy

### Unit Tests:

- Brak runnera testów jednostkowych dla UI; kontrola `check-ui-tokens` testowana na pliku pozytywnym i negatywnym (faza 5).

### Integration Tests:

- `npm run smoke` po fazie 3 (auth + ścieżka wydatków/przychodów), na buildzie produkcyjnym.

### Manual Testing Steps:

1. Dev server, dashboard desktop i 390 px: wygląd bez delty względem stanu sprzed zmiany.
2. Otwarcie `EntrySheet` (wydatek i przychód): pola, select, siatka kategorii, `Drawer` ciemny.
3. Nawigacja klawiszem Tab po całym widoku: fokus widoczny na każdej kontrolce.
4. Strony auth, settings, history: bez regresji po zmianie `--primary` i `ServerError`.
5. Po buildzie zrestartować dev server i odświeżyć twardo (wyspy po buildzie są nieaktualne).

## Performance Considerations

Brak. Zmiana dotyczy klas CSS i trzech małych komponentów.

## Migration Notes

Brak danych do migracji. Wycofanie: revert commitów faz; `<html class="dark">` i wartości tokenów zmieniają się razem (faza 2).

## References

- Related research: `context/changes/dashboard-design-tokens/research.md`
- Źródło tokenów: `src/styles/global.css:5-97`
- Kontrakt i macierz stanów: skill `10x-ui`

## Progress

> Convention: `- [ ]` pending, `- [x]` done. Append ` — <commit sha>` when a step lands. Do not rename step titles. See `references/progress-format.md`.

### Phase 1: Komponenty `ui/`

#### Automated

- [x] 1.1 Lint i build przechodzą: `npm run lint && npm run build` — 4cdf8ab
- [x] 1.2 Pliki `ui/input.tsx`, `ui/select.tsx`, `ui/card.tsx`, `ui/label.tsx` istnieją — 4cdf8ab

#### Manual

- [x] 1.3 Select działa w wyspie React i w Drawer (albo decyzja o natywnym fallbacku) — f44bec5

### Phase 2: Wartości tokenów

#### Automated

- [x] 2.1 Build i typy przechodzą: `npm run build && npx astro check` — afb9550
- [x] 2.2 `global.css` nie zawiera hexów poza blokiem wartości tokenów (skan) — afb9550

#### Manual

- [x] 2.3 Dashboard wygląda jak przed zmianą (ciemny, fioletowy akcent), Drawer ciemny bez nadpisań — afb9550
- [x] 2.4 Zrzuty auth/settings/history bez regresji po zmianie `--primary` — afb9550
- [x] 2.5 EntrySheet po podbiciu Radix pod vaul: zapis, zamknięcie X i Esc, wybór daty nie zamyka panelu — afb9550

### Phase 3: Widok dashboard

#### Automated

- [x] 3.1 Skan hardcodów na 7 plikach widoku zwraca 0 trafień — f44bec5
- [x] 3.2 Lint, typy i build przechodzą: `npm run lint && npx astro check && npm run build` — f44bec5
- [x] 3.3 Smoke test przechodzi: `npm run smoke` — f44bec5

#### Manual

- [x] 3.4 Zrzuty desktop i 390 px zgodne z wyglądem sprzed zmiany — f44bec5
- [x] 3.5 Fokus klawiatury widoczny na każdej kontrolce, w tym „Wyloguj” i „Więcej opcji” — f44bec5

### Phase 4: Stany i bramka wizualna

#### Automated

- [x] 4.1 Kitchen-sink zwraca 404 w buildzie produkcyjnym (`npm run preview`)

#### Manual

- [x] 4.2 7-stanowa macierz: każda komórka pokazana lub N/A z powodem
- [x] 4.3 Zrzuty kitchen-sink desktop i 390 px zapisane w folderze zmiany

### Phase 5: Zabezpieczenie

#### Automated

- [ ] 5.1 `node scripts/check-ui-tokens.mjs` na 7 plikach widoku zwraca 0
- [ ] 5.2 Skrypt zwraca 1 na pliku testowym z `bg-purple-600`
- [ ] 5.3 `lint-staged` uruchamia kontrolę dla oczyszczonych plików

#### Manual

- [ ] 5.4 Blok UI w `CLAUDE.md` poza blokiem zarządzanym przez CLI
