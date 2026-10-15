# Topbar menu: zamykanie po kliknięciu obok i po Esc Implementation Plan

## Overview

Menu hamburger (telefon) i rozwijane „Ustawienia” (desktop) w `src/components/Topbar.astro` zamykają się po kliknięciu poza menu, po Esc (fokus wraca na nagłówek menu) i po wyjściu fokusu z menu. Wygląd i markup menu bez zmian; dochodzą dwa atrybuty i mały `<script>`.

## Current State Analysis

- `Topbar.astro` ma trzy natywne `<details>`: hamburger `:37` (`sm:hidden`), zagnieżdżone „Ustawienia” w hamburgerze `:76` (`open={inSettings}`) i desktopowe „Ustawienia” `:144`. Żaden skrypt nie zamyka ich poza kliknięciem w własny nagłówek (zachowanie natywne, nie regres).
- Topbar jest używany na dashboardzie, history, settings (2 strony) i `Welcome.astro`; wariant niezalogowany nie ma `<details>`.
- Precedens małego `<script>` w komponencie `.astro`: `src/pages/history.astro:138`. Brak `ClientRouter`/przejść widoków, więc każda nawigacja to pełne przeładowanie i skrypt nie wymaga ponownej inicjalizacji.
- `Topbar.astro` jest w `CLEAN_PATHS` (`scripts/check-ui-tokens.mjs`): kod nie może dodawać klas palety (skrypt ich nie potrzebuje).
- `lessons.md`: żadna reguła nie dotyczy tej zmiany.
- Brak runnera testów interfejsu; `scripts/smoke.mjs` sprawdza tylko HTTP i nie zależy od markupu menu (omija teksty Topbara w asercjach: `smoke.mjs:323,410,533`).

## Desired End State

Na każdej stronie z zalogowanym Topbarem: otwarte menu zamyka się po kliknięciu poza nim, po Esc (fokus wraca na nagłówek menu, jeśli był w menu) i po wyjściu fokusu poza menu (Tab). Kliknięcie w środku menu (w tym w zagnieżdżone „Ustawienia”) go nie zamyka. Bez JavaScriptu menu działa jak dotąd. Wygląd identyczny jak przed zmianą.

### Key Discoveries:

- Logikę trzeba ograniczyć do dwóch `<details>` najwyższego poziomu (`data-topbar-menu`); zagnieżdżone „Ustawienia” w hamburgerze zamknie się razem z rodzicem.
- Kliknięcie we własny nagłówek nie może być traktowane jako „poza” (natywne przełączanie ma działać).
- `focusout` z `relatedTarget === null` (klik w niefokusowalne miejsce, alt-tab) nie zamyka menu; klik/dotknięcie poza obsługuje osobny nasłuchiwacz `pointerdown`.

## What We're NOT Doing

- Migracji menu na shadcn `DropdownMenu` (osobna decyzja produktowa; zmieniłaby wygląd menu na telefonie).
- Nawigacji strzałkami (góra/dół) po pozycjach menu.
- Zmian wyglądu, tokenów, innych komponentów, wariantu niezalogowanego, strony `/dev/dashboard-states`.

## Implementation Approach

Zostawiamy natywne `<details>` (działają też bez JS) i dopisujemy trzy nasłuchiwacze w jednym `<script>` w `Topbar.astro`. Dwa `<details>` najwyższego poziomu dostają `data-topbar-menu`. Praca na gałęzi `feat/topbar-menu-close-on-outside`.

## Phase 1: Skrypt zamykający menu

### Overview

Dodać atrybuty i skrypt w `Topbar.astro`.

### Changes Required:

#### 1. Atrybuty menu najwyższego poziomu

**File**: `src/components/Topbar.astro`

**Intent**: oznaczyć dwa `<details>` (hamburger i desktopowe „Ustawienia”), których dotyczy zamykanie; zagnieżdżone „Ustawienia” w hamburgerze zostaje bez atrybutu.

**Contract**: atrybut `data-topbar-menu` na `<details class="sm:hidden">` (`:37`) i `<details class="relative flex-1">` (`:144`); pozostały markup i klasy bez zmian.

#### 2. Skrypt zamykający

**File**: `src/components/Topbar.astro` (blok `<script>` na końcu pliku, wzorzec jak `history.astro:138`)

**Intent**: zamykać otwarte menu po kliknięciu poza nim, po Esc i po wyjściu fokusu.

**Contract**: dla każdego `details[data-topbar-menu]`:

- `document` `pointerdown` (nie `click`: na iOS Safari `click` nie zawsze dociera do `document` z niewidocznych dla niego elementów, np. tła strony): otwarte menu, które nie zawiera `event.target` → `open = false` (dotknięcie własnego nagłówka nie jest „poza”, więc natywne przełączanie działa);
- `document` `keydown` Esc: zamyka otwarte menu; jeśli `document.activeElement` jest w menu, fokus wraca na jego `<summary>`;
- menu `focusout`: zamyka, gdy `relatedTarget` jest niepusty i poza menu (puste `relatedTarget` nie zamyka);
- bez dodatkowych klas i stylów (`check:ui` ma zostać zielone); typy: `querySelectorAll<HTMLDetailsElement>`, `event.target instanceof Node`.

### Success Criteria:

#### Automated Verification:

- Lint, typy i build przechodzą: `npm run lint && npx astro check && npm run build`
- Kontrola tokenów przechodzi: `npm run check:ui`
- Smoke test przechodzi: `npm run smoke`

Kolejność uruchamiania: `npx supabase start` → `npm run build` → `npm run preview` w jednym terminalu i `npm run smoke` w drugim (domyślnie `BASE_URL=http://localhost:4321`). `build` psuje działający dev serwer (islands przestają się ładować), więc przed testem ręcznym 1.4 i fazą 2 uruchom dev serwer od nowa i odśwież stronę twardo (Ctrl+F5).

#### Manual Verification:

- Kliknięcie poza otwartym menu zamyka je (telefon i desktop); szybka bramka na dev serwerze przed pełnym testem Playwright w fazie 2 (Esc i Tab sprawdza faza 2)

**Implementation Note**: After completing this phase and all automated verification passes, pause here for manual confirmation from the human that the manual testing was successful before proceeding to the next phase. Phase blocks use plain bullets — the corresponding `- [ ]` checkboxes for these items live in the `## Progress` section at the bottom of the plan.

---

## Phase 2: Weryfikacja w przeglądarce

### Overview

Sprawdzić zachowanie i wygląd w przeglądarce, zanim zmiana trafi do PR.

### Changes Required:

#### 1. Test zachowania

**File**: brak zmian w kodzie (poprawki wracają do fazy 1); dowody w `context/changes/topbar-menu-close-on-outside/screenshots/` (jeśli potrzebne).

**Intent**: potwierdzić zachowanie na prawdziwym, zalogowanym Topbarze.

**Contract**: dev serwer (`npm run dev -- --port 4401`), lokalny Supabase (`npx supabase start`), konto testowe (rejestracja na `/auth/signup`), Playwright (390 px i 1280 px). Scenariusze: otwórz menu → kliknij poza → zamknięte; otwórz → Esc → zamknięte, fokus na nagłówku; otwórz → Tab poza menu → zamknięte; hamburger: rozwiń zagnieżdżone „Ustawienia” → menu pozostaje otwarte po kliknięciu w jego `<summary>` i po kliknięciu w jego listę linków (pusty obszar wokół), zamyka się po kliknięciu poza; klik w link menu → przejście na stronę; desktop „Ustawienia” → te same scenariusze; wygląd: jeden zrzut otwartego menu „po” na 390 px i 1280 px (zmiana nie dotyka klas, więc bez porównania z `master`).

### Success Criteria:

#### Automated Verification:

- Skrypty przeglądarkowe Playwright potwierdzają zamykanie po kliknięciu poza i po Esc (skrypt i zrzuty zapisane w `context/changes/topbar-menu-close-on-outside/screenshots/`)

#### Manual Verification:

- Hamburger na telefonie (390 px): klik poza, Esc i Tab poza menu zamykają menu; zagnieżdżone „Ustawienia” działa
- Desktop („Ustawienia”): klik poza, Esc i Tab poza menu zamykają menu
- Wygląd otwartego menu (zrzut „po”) zgodny z dotychczasowym, bez nowych elementów

---

## Testing Strategy

### Unit Tests:

- Brak runnera testów interfejsu w repo; zachowanie weryfikujemy w przeglądarce (faza 2).

### Integration Tests:

- `npm run smoke` na buildzie produkcyjnym (HTTP, niezależny od markupu menu).

### Manual Testing Steps:

1. Zaloguj się, otwórz hamburger na 390 px, kliknij w puste tło strony: menu ma się zamknąć.
2. Otwórz menu, naciśnij Esc: menu zamknięte, fokus na przycisku menu.
3. Otwórz menu i naciśnij Tab aż fokus wyjdzie poza menu: menu zamknięte.
4. Rozwiń „Ustawienia” w hamburgerze, kliknij w ten blok: menu zostaje otwarte.
5. Powtórz 1–3 dla desktopowego „Ustawienia”.

## Performance Considerations

Brak: kilka nasłuchiwaczy na `document` i `details`, bez pętli ani zapytań.

## Migration Notes

Brak. Wycofanie: revert commitu fazy 1.

## References

- Follow-up źródłowy: `context/archive/2026-10-15-dashboard-design-tokens/follow-ups/review-fixes.md`
- Precedens `<script>` w komponencie: `src/pages/history.astro:138`
- Menu: `src/components/Topbar.astro:37,76,144`

## Progress

> Convention: `- [ ]` pending, `- [x]` done. Append ` — <commit sha>` when a step lands. Do not rename step titles. See `references/progress-format.md`.

### Phase 1: Skrypt zamykający menu

#### Automated

- [x] 1.1 Lint, typy i build przechodzą: `npm run lint && npx astro check && npm run build`
- [x] 1.2 Kontrola tokenów przechodzi: `npm run check:ui`
- [x] 1.3 Smoke test przechodzi: `npm run smoke`

#### Manual

- [x] 1.4 Kliknięcie poza otwartym menu zamyka je (telefon i desktop); szybka bramka na dev serwerze przed pełnym testem Playwright w fazie 2 (Esc i Tab sprawdza faza 2)

### Phase 2: Weryfikacja w przeglądarce

#### Automated

- [ ] 2.1 Skrypty przeglądarkowe Playwright potwierdzają zamykanie po kliknięciu poza i po Esc (skrypt i zrzuty zapisane w `context/changes/topbar-menu-close-on-outside/screenshots/`)

#### Manual

- [ ] 2.2 Hamburger na telefonie (390 px): klik poza, Esc i Tab poza menu zamykają menu; zagnieżdżone „Ustawienia” działa
- [ ] 2.3 Desktop („Ustawienia”): klik poza, Esc i Tab poza menu zamykają menu
- [ ] 2.4 Wygląd otwartego menu (zrzut „po”) zgodny z dotychczasowym, bez nowych elementów
