# Strona główna na tokenach stylów Implementation Plan

## Overview

Strona główna `/` (`src/pages/index.astro` + `src/components/Welcome.astro`) przechodzi z literałów palety Tailwinda i wartości arbitralnych na tokeny z `src/styles/global.css`. Orby i pole gwiazd w tle znikają (przyszły projekt strony ich nie przewiduje), przyciski CTA dostają styl z `buttonVariants` (`ui/button`), a trzy skopiowane karty funkcji stają się jedną kartą `ui/card` renderowaną z tablicy. Na końcu oba pliki trafiają do `CLEAN_PATHS`, więc `check:ui` i pre-commit pilnują ich na przyszłość. Wygląd zachowuje dzisiejszą geometrię hero; zmieniają się tylko świadomie zaakceptowane szczegóły (opisane niżej).

## Current State Analysis

- Skan wartości zakodowanych na sztywno (regex z `scripts/check-ui-tokens.mjs:23-25`): `Welcome.astro` = 20 linii, `index.astro` = 0 (stan `70c105f`). `index.astro` tylko renderuje `<Welcome />` w `<Layout>` (`index.astro:6-8`).
- Literały, które mają już token o tej samej wartości w trybie ciemnym: `text-white` = `--foreground`, `border-white/10` = `--border`, `border-white/20` = `--input`, `hover:bg-white/10` = `--accent`, `bg-purple-600`/`hover:bg-purple-500` = `--primary`/`--primary-hover` (`global.css:57,62,64,69,72,73`).
- Literały z rozjazdem: `text-blue-100/70` i `/60` → `--muted-foreground` ma 80% (`global.css:68`); `bg-white/5` → `--card` ma 10% (`global.css:58`); tytuł `from-blue-200 via-purple-200 to-pink-200` → `--title-from`/`--title-to` dają 2 stopnie (`global.css:80-81`, użyte w `MonthScreen.tsx:47`).
- `ui/button.tsx` eksportuje `buttonVariants` (`:50`), nieużywane poza własnym plikiem. Wariant `default` = `bg-primary ... hover:bg-primary-hover` (`:12`), `outline` w ciemnym motywie dodaje wypełnienie `dark:bg-input/30` (`:15-16`), rozmiar `lg` = `h-10 px-6 text-sm rounded-md` (`:24`). Komponent ma `focus-visible:ring-[3px]` (`:8`).
- `ui/card.tsx:8` = `bg-card text-card-foreground flex flex-col gap-6 rounded-xl border py-6 shadow-sm`; precedens nadpisań: `MonthScreen.tsx:56`.
- `/` jest tylko dla niezalogowanych (`middleware.ts:6,26-27`), więc `Topbar` na tej stronie to zawsze wariant niezalogowany (`Topbar.astro:162-179`) i powiela dwa linki z hero. Topbar jest poza zakresem.
- `lessons.md`: reguła o `:root` razem z `.dark` nie wchodzi w grę, bo ta zmiana nie dodaje tokenów.
- Brak runnera testów interfejsu; wzorzec weryfikacji z `topbar-menu-close-on-outside`: skrypt Playwright jako wyrażenie funkcji w `screenshots/` zmiany, uruchamiany przez `browser_run_code_unsafe`. `eslint.config.js` już ignoruje `context/**/screenshots/**`.

## Desired End State

Strona `/` renderuje się bez orbów i gwiazd, z kolorami, obramowaniami i tekstem wyłącznie z tokenów, z CTA opartymi na `buttonVariants` (widoczny pierścień fokusu klawiatury), z trzema kartami z jednego źródła, a `Welcome.astro` i `index.astro` są w `CLEAN_PATHS` i przechodzą `npm run check:ui`. Weryfikacja: skan wartości na obu plikach = 0 trafień, `lint`/`astro check`/`build`/`check:ui`/`smoke` zielone, zrzuty „po" na 390 i 1280 px zaakceptowane względem zrzutów „przed".

### Key Discoveries:

- Większość migracji to podmiana klas na tokeny o identycznej wartości (tabela w „Current State"); wizualnie zmieniają się tylko cztery rzeczy: tekst jaśniejszy (80%), tytuł 2-stopniowy, karty 10% zamiast 5%, wypełnienie wariantu outline.
- `cva` (`buttonVariants`) nie łączy klas przez `tailwind-merge`, więc nadpisanie rozmiaru CTA wymaga `cn()` (zob. „Critical Implementation Details").
- Nowych tokenów nie potrzeba, bo dekoracje (jedyne bez tokenów) są usuwane.

## What We're NOT Doing

- Nowych tokenów ani zmian w `src/styles/global.css`.
- Orbów i gwiazd w żadnej formie (decyzja użytkownika: przyszły projekt strony ich nie ma).
- Zmian w `Topbar` ani usuwania duplikatu linków „Zaloguj się / Załóż konto" (zarzut odroczony, `research.md` D1).
- Pozostałych widoków z paletą: `pages/auth/*`, `components/auth/*`, `history/*`, `settings/*`, `ui/LibBadge.astro`, `Banner.astro` (osobne zmiany).
- Redesignu marketingowego, nowego copy, nowych sekcji, jasnego motywu.
- Runnera `toHaveScreenshot` ani nowych zależności.

## Implementation Approach

Zachowujemy dzisiejszą geometrię hero (rozmiar CTA, odstępy, układ siatki), a kolory, obramowania i tekst bierzemy z tokenów (wariant „kolory z tokenów, geometria hero zostaje"). Najpierw zrzuty bazowe „przed" (żeby zmianę dało się ocenić), potem jedna zmiana w `Welcome.astro`, na końcu zrzuty „po", test fokusu/hover i dopisanie plików do `CLEAN_PATHS`. Praca na gałęzi `feat/home-design-tokens`.

## Critical Implementation Details

- **Łączenie klas CTA:** `buttonVariants()` składa klasy przez `cva`, które nie rozwiązuje konfliktów (`h-9` obok `h-auto` zostaje w stringu, wygrywa kolejność CSS, nie intencja). Nadpisanie geometrii hero musi iść przez `cn()` z `@/lib/utils` (clsx + tailwind-merge, `CLAUDE.md`):

  ```astro
  ---
  import { buttonVariants } from "@/components/ui/button";
  import { cn } from "@/lib/utils";
  const cta = "h-auto px-6 py-3 text-base rounded-lg shadow-none"; // geometria hero z dzisiejszej strony; bez cienia shadow-xs z buttonVariants
  ---
  <a href="/auth/signin" class={cn(buttonVariants({ variant: "default" }), cta)}>Zaloguj się</a>
  ```

## Phase 1: Zrzuty bazowe „przed"

### Overview

Zanim ruszymy kod, zapisujemy, jak strona wygląda dziś (390 i 1280 px) i jak zachowuje się fokus klawiatury na CTA. Bez tego nie da się ocenić zmiany ani obalić/potwierdzić zarzutu o fokusie (`research.md` C4).

### Changes Required:

#### 1. Skrypt Playwright „przed"

**File**: `context/changes/home-design-tokens/screenshots/home-before.check.js` (nowy)

**Intent**: sprawdzić stan `/` przed zmianą: zrobić zrzuty i zmierzyć, czy fokus klawiatury na pierwszym CTA ma widoczny obrys.

**Contract**: wyrażenie funkcji `async (page) => { ... }` (bez końcowego `;`, ładowane przez `browser_run_code_unsafe` z `filename`, jak w `topbar-menu-close-on-outside`); bez logowania (strona dla niezalogowanych). Dla `390x844` i `1280x800`: `goto http://localhost:4401/`, zrzut `home-before-<szerokość>.png` do `screenshots/`; następnie `Tab` aż `document.activeElement` będzie CTA „Zaloguj się" **w sekcji hero** (lokator linków zawężony do rodzica `h1`; nie pierwsze trafienie `a[href="/auth/signin"]`, bo wariant niezalogowany Topbara ma ten sam link wcześniej w kolejności tabulacji i z własnym pierścieniem fokusu, `Topbar.astro:167`) i odczyt `getComputedStyle` (`outline-style`, `outline-width`, `box-shadow`) jako wynik „fokus przed". Zwraca obiekt z wynikami; funkcja dostaje tylko `page`, więc wynik do `screenshots/home-before-focus.txt` zapisuje implementer po uruchomieniu. Dev serwer: `npx astro dev --background --port 4401` (zatrzymanie: `npx astro dev stop`).

### Success Criteria:

#### Automated Verification:

- Zrzuty bazowe istnieją: `ls context/changes/home-design-tokens/screenshots/home-before-390.png context/changes/home-design-tokens/screenshots/home-before-1280.png`
- Wynik fokusu „przed" zapisany w pliku: `ls context/changes/home-design-tokens/screenshots/home-before-focus.txt`

#### Manual Verification:

- Zrzuty „przed" pokazują dzisiejszą stronę (orby, gwiazdy, tytuł, 2 CTA, 3 karty), a konsola przeglądarki jest bez błędów

**Implementation Note**: After completing this phase and all automated verification passes, pause here for manual confirmation from the human that the manual testing was successful before proceeding to the next phase. Phase blocks use plain bullets — the corresponding `- [ ]` checkboxes for these items live in the `## Progress` section at the bottom of the plan.

---

## Phase 2: Widok na tokenach

### Overview

Jedna zmiana w `Welcome.astro`: usunięcie dekoracji, migracja kolorów na tokeny, CTA przez `buttonVariants`, karty przez `ui/card` z tablicy.

### Changes Required:

#### 1. Usunięcie orbów i gwiazd

**File**: `src/components/Welcome.astro`

**Intent**: usunąć dekoracje bez tokenów; tło zostaje samo `bg-cosmic`.

**Contract**: znikają trzy `div` orbów (`:7-9`), pole gwiazd z inline `style` (`:14`) oraz ich komentarze; korzeń `div.bg-cosmic ...` i kontener treści bez zmian.

#### 2. Hero: tytuł, tekst, CTA

**File**: `src/components/Welcome.astro`

**Intent**: zamienić literały na tokeny i oprzeć CTA o istniejący komponent, zachowując geometrię hero.

**Contract**: `h1` używa `from-title-from to-title-to` (jak `MonthScreen.tsx:47`) zamiast `from-blue-200 via-purple-200 to-pink-200`; akapit `text-muted-foreground`; oba CTA to `<a>` ze `class={cn(buttonVariants({ variant }), cta)}` (wariant `default` dla „Zaloguj się", `outline` dla „Załóż konto"), gdzie `cta` zachowuje dzisiejszą geometrię (zob. „Critical Implementation Details"). Importy `buttonVariants` z `@/components/ui/button` i `cn` z `@/lib/utils` w frontmatter.

#### 3. Karty funkcji z jednej tablicy

**File**: `src/components/Welcome.astro`

**Intent**: zastąpić trzy skopiowane bloki jedną kartą `ui/card` renderowaną z tablicy w frontmatter.

**Contract**: tablica `features` z trzema pozycjami (`title`, `text`, `icon` = wnętrze SVG jako stała string renderowana przez `set:html` na `<svg>`); każda karta to `<Card className="gap-0 p-6 shadow-none backdrop-blur-xl">` (precedens `MonthScreen.tsx:56`), tytuł `text-foreground`, tekst `text-muted-foreground text-sm leading-relaxed`, ikona `text-link mb-4`. Siatka `grid ... sm:grid-cols-3` bez zmian. `Card` (React) bez dyrektywy `client:*`, tak jak inne statyczne użycia w `.astro`.

#### 4. `index.astro`

**File**: `src/pages/index.astro`

**Intent**: bez zmian (0 trafień skanu); wymieniony, bo trafia do `CLEAN_PATHS` w fazie 3.

**Contract**: brak zmian.

### Success Criteria:

#### Automated Verification:

- Lint, typy i build przechodzą: `npm run lint && npx astro check && npm run build`
- Skan wartości na widoku daje 0 trafień: `grep -nE '#[0-9a-fA-F]{3,8}\b|rgba?\(|hsla?\(|oklch\(|-\[[0-9.]+(px|rem)\]|\b(bg|text|border|ring|outline|from|via|to|fill|stroke|shadow|divide)-(slate|gray|zinc|neutral|stone|red|orange|amber|yellow|lime|green|emerald|teal|cyan|sky|blue|indigo|violet|purple|fuchsia|pink|rose|white|black)\b' src/components/Welcome.astro src/pages/index.astro` (brak wyjścia, kod 1)

#### Manual Verification:

- Strona `/` na dev serwerze (390 i 1280 px) wygląda poprawnie: bez orbów i gwiazd, tytuł z gradientem, dwa CTA, trzy karty, konsola bez błędów

**Implementation Note**: After completing this phase and all automated verification passes, pause here for manual confirmation from the human that the manual testing was successful before proceeding to the next phase. Phase blocks use plain bullets — the corresponding `- [ ]` checkboxes for these items live in the `## Progress` section at the bottom of the plan.

---

## Phase 3: Stany, bramka wizualna i zabezpieczenie

### Overview

Zrzuty „po", sprawdzenie stanów interaktywnych CTA (hover, fokus klawiatury) i dopisanie obu plików do `CLEAN_PATHS`, żeby kontrola tokenów pilnowała strony od teraz.

### Changes Required:

#### 1. Skrypt Playwright „po"

**File**: `context/changes/home-design-tokens/screenshots/home-after.check.js` (nowy)

**Intent**: potwierdzić zachowanie po zmianie i zapisać zrzuty do porównania z bazą.

**Contract**: wyrażenie funkcji jak w fazie 1; dla `390x844` i `1280x800` zrzut `home-after-<szerokość>.png`; dla obu CTA w sekcji hero (lokatory zawężone do rodzica `h1`, jak w fazie 1, żeby nie mierzyć linków Topbara): `Tab` fokus ma niepusty obrys lub `box-shadow` (pierścień `ring`), `hover` zmienia tło w stosunku do stanu spoczynku; style odczytywane dopiero po zakończeniu przejścia (`buttonVariants` ma `transition-all`, `button.tsx:8`), np. przez `waitForFunction` na stabilną wartość. Przy fokusie skrypt robi zrzut `home-after-focus-<szerokość>.png` (dowód do 3.6). Brak dekoracji = w widoku nie ma elementów z klasą zaczynającą się od `blur-` ani atrybutu `style` z `radial-gradient`; kart jest dokładnie 3. Zwraca wiersze `{ name, pass, detail }`.

#### 2. Kontrola tokenów obejmuje stronę główną

**File**: `scripts/check-ui-tokens.mjs`

**Intent**: dopisać oba widoki do listy oczyszczonych, żeby `npm run check:ui` i pre-commit je skanowały (zasada z `CLAUDE.md`: migrując widok, dopisz go do `CLEAN_PATHS`).

**Contract**: do tablicy `CLEAN_PATHS` (`:11-18`) dochodzą `"src/components/Welcome.astro"` i `"src/pages/index.astro"`; reszta pliku bez zmian.

### Success Criteria:

#### Automated Verification:

- Skrypt „po" potwierdza fokus i hover CTA oraz zapisuje zrzuty (`home-after-390.png`, `home-after-1280.png` w `screenshots/`)
- Kontrola tokenów przechodzi z obiema stronami w `CLEAN_PATHS`: `npm run check:ui`
- Lint, typy i build przechodzą: `npm run lint && npx astro check && npm run build`
- Smoke test przechodzi: `npm run smoke`

Kolejność uruchamiania smoke: `npx supabase start` → `npm run build` → `npm run preview` w jednym terminalu i `npm run smoke` w drugim (`.dev.vars` ma wskazywać lokalny Supabase). `build` psuje działający dev serwer, więc przed testem Playwright uruchom dev serwer od nowa (`npx astro dev --background --port 4401`).

#### Manual Verification:

- Zrzuty „po" na 390 i 1280 px zaakceptowane względem zrzutów „przed" (zamierzone różnice: tekst jaśniejszy 80%, 2-stopniowy tytuł, wypełnienie wariantu outline na CTA „Załóż konto", wyraźniejsze karty 10%)
- Fokus klawiatury jest widoczny na obu CTA (zrzut ze stanu fokusu)

---

## Testing Strategy

### Unit Tests:

- Brak runnera testów interfejsu w repo; zachowanie i wygląd weryfikujemy skryptami Playwright (fazy 1 i 3).

### Integration Tests:

- `npm run smoke` na buildzie produkcyjnym (HTTP; nie zależy od markupu strony głównej).

### Manual Testing Steps:

1. Otwórz `/` na 390 i 1280 px jako niezalogowany: brak orbów i gwiazd, tytuł, dwa CTA, trzy karty.
2. Przejdź `Tab` do CTA: widoczny pierścień fokusu; najechanie zmienia kolor tła.
3. Porównaj `home-before-*.png` z `home-after-*.png`.

## Performance Considerations

Brak problemów. Usunięcie orbów (blur 100–140 px) i trzech warstw gradientów gwiazd może tylko zmniejszyć koszt renderowania tła.

## Migration Notes

Brak migracji. Wycofanie: revert commitów zmiany (`git revert -m 1 <merge>` po scaleniu PR).

## References

- Related research: `context/changes/home-design-tokens/research.md`
- Poprzednia zmiana tokenów (wzorzec): `context/archive/2026-10-15-dashboard-design-tokens/` (`research.md`, `tokens.md`)
- Wzorzec weryfikacji Playwright: `context/archive/2026-10-15-topbar-menu-close-on-outside/screenshots/topbar-menu.check.js`
- Gradient tytułu i karta: `src/components/month/MonthScreen.tsx:47,56`

## Progress

> Convention: `- [ ]` pending, `- [x]` done. Append ` — <commit sha>` when a step lands. Do not rename step titles. See `references/progress-format.md`.

### Phase 1: Zrzuty bazowe „przed"

#### Automated

- [x] 1.1 Zrzuty bazowe istnieją: `ls context/changes/home-design-tokens/screenshots/home-before-390.png context/changes/home-design-tokens/screenshots/home-before-1280.png` — 4f1950d
- [x] 1.2 Wynik fokusu „przed" zapisany w pliku: `ls context/changes/home-design-tokens/screenshots/home-before-focus.txt` — 4f1950d

#### Manual

- [x] 1.3 Zrzuty „przed" pokazują dzisiejszą stronę (orby, gwiazdy, tytuł, 2 CTA, 3 karty), a konsola przeglądarki jest bez błędów — 4f1950d

### Phase 2: Widok na tokenach

#### Automated

- [x] 2.1 Lint, typy i build przechodzą: `npm run lint && npx astro check && npm run build`
- [x] 2.2 Skan wartości na widoku daje 0 trafień (komenda grep z `10x-ui` na `Welcome.astro` i `index.astro`)

#### Manual

- [x] 2.3 Strona `/` na dev serwerze (390 i 1280 px) wygląda poprawnie: bez orbów i gwiazd, tytuł z gradientem, dwa CTA, trzy karty, konsola bez błędów

### Phase 3: Stany, bramka wizualna i zabezpieczenie

#### Automated

- [ ] 3.1 Skrypt „po" potwierdza fokus i hover CTA oraz zapisuje zrzuty (`home-after-390.png`, `home-after-1280.png` w `screenshots/`)
- [ ] 3.2 Kontrola tokenów przechodzi z obiema stronami w `CLEAN_PATHS`: `npm run check:ui`
- [ ] 3.3 Lint, typy i build przechodzą: `npm run lint && npx astro check && npm run build`
- [ ] 3.4 Smoke test przechodzi: `npm run smoke`

#### Manual

- [ ] 3.5 Zrzuty „po" na 390 i 1280 px zaakceptowane względem zrzutów „przed" (zamierzone różnice: tekst 80%, 2-stopniowy tytuł, wypełnienie outline, karty 10%)
- [ ] 3.6 Fokus klawiatury jest widoczny na obu CTA (zrzut ze stanu fokusu)
