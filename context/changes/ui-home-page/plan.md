# Projekt strony startowej Implementation Plan

## Overview

Przebudowa strony `/` według szkicu `reference/hero-karuzela.html`, traktowanego jako propozycja, nie wyznacznik: gradientowy `h1` „Hajsownik" (obecny styl), przeredagowany opis (kilka sekund, od razu, ile zostaje), linia „Jeden dom, wspólne dane" z wstawką o prywatności, jeden duży przycisk „Załóż konto" i karuzela 3 slajdów (formularz wydatku, przepływ pieniędzy, lupa na liście). Bez hexów i literałów w widoku; kolory kategorii jako nowe tokeny.

## Current State Analysis

- `/` renderuje `Welcome.astro` (`bg-cosmic`, `<Topbar />`, hero z `h1` „Hajsownik", dwa CTA przez `buttonVariants`+`cn`, trzy karty funkcji): `src/components/Welcome.astro:7-11,33-81`; `src/pages/index.astro:6-8`.
- Wariant niezalogowany `Topbar` pokazuje „Niezalogowano" + „Zaloguj się" + „Załóż konto": `src/components/Topbar.astro:162-179`; w praktyce renderuje się tylko na `/` (reszta tras jest chroniona, `src/middleware.ts:4`).
- Szkic ma 15 zmiennych zgodnych z `.dark` (`global.css:54-99`), ale łamie `check:ui` hexami w SVG (`hero-karuzela.html:185-186`), literałami `oklch()`/`#fff` i arbitralnymi px. `Welcome.astro` i `index.astro` są w `CLEAN_PATHS` (`scripts/check-ui-tokens.mjs:12-13`).
- Tokeny kolorów wykresów: tylko `--chart-1..5` (`global.css:86-90`), za mało i inne odcienie niż w szkicu.
- `scripts/smoke.mjs:111,215` wymaga: `/` → 200 dla anonima, 302 → `/dashboard` dla zalogowanego. Żaden test nie sprawdza treści `Welcome`/`Topbar`.

## Desired End State

Anonim wchodzi na `/` i widzi: pasek (Topbar z samym „Zaloguj się"), gradientowe „Hajsownik", krótki opis, linię o wspólnych danych i prywatności, duży przycisk „Załóż konto" oraz karuzelę 3 slajdów. Poniżej `lg` (1024 px) wszystko w jednej kolumnie, od `lg` tekst po lewej, karuzela po prawej. Slajdy 2 i 3 mieszczą się między strzałkami. `npm run check:ui`, lint, `astro check`, build i `smoke` przechodzą.

### Key Discoveries:

- Wzorzec CTA: `cn(buttonVariants(...), geometria)` (`Welcome.astro:7-11`); `buttonVariants` nie ma innych użyć.
- Wzorzec skryptu w Astro z zamykaniem na zewnątrz i klawiaturą: `Topbar.astro:182-210`.
- Wzorzec tła z tokenów: `@utility bg-cosmic` (`global.css:151-153`).
- Etykieta miesiąca: gotowe `currentMonthStart()` i `formatMonthLabel()` (`src/lib/dates.ts:24,38`), używane już m.in. w `EntrySheet.tsx:20,177`.
- Reguła `lessons.md`: każdy nowy token ma wartość w `:root` i `.dark` w tej samej zmianie.
- Tailwind 4 pozwala na liczby w skali spacingu (np. `h-155` = 620 px), więc rozmiary telefonu i slajdów nie wymagają wartości `[…px]`.

## What We're NOT Doing

- Nie zmieniamy `middleware.ts`, tras, API ani bazy.
- Nie ruszamy innych widoków (auth, history, settings, `Banner`) ani wariantu zalogowanego `Topbar`.
- Nie dodajemy autoodtwarzania karuzeli, biblioteki karuzeli ani przeciągania myszką (dotyk działa natywnie przez scroll-snap, na komputerze są strzałki, paski i klawisze).
- Nie robimy jasnego wariantu strony ani go nie weryfikujemy (powstanie osobno), ale go nie blokujemy: nowe tokeny dostają prawdziwe wartości `:root` (reguła z `lessons.md`), a literały ze szkicu mapujemy na istniejące tokeny, które dostaną jasne wartości razem z motywem.
- Nie budujemy osobnej strony stanów w `/dev` (zawartość statyczna; stany CTA, strzałek i pasków sprawdzamy zrzutami).
- Nie zostawiamy kart funkcji.

## Implementation Approach

Fazy idą od tokenów do widoku: najpierw tokeny i drobna zmiana Topbaru, potem komponent karuzeli (samodzielny, SVG generowane z danych w frontmatter Astro, kolory przez klasy tokenów), potem złożenie strony i kopia, na końcu weryfikacja i bramka wizualna. Odchylenia od szkicu (decyzje użytkownika): Topbar zostaje bez „Załóż konto"; karty funkcji zastąpione opisem i linią „Jeden dom, wspólne dane" + prywatność; nazwa aplikacji jako gradientowy `h1`, hasło ze szkicu jako podtytuł; slajdy 2 i 3 węższe; kwoty w przepływie zawinięte pod nazwę kategorii bez nachodzenia; kafelek „Zostaje" ze znakiem „−" między małymi kafelkami Przychody i Wydatki; breakpoint `lg`; etykieta miesiąca renderowana na serwerze przez istniejące `formatMonthLabel(currentMonthStart())` z `src/lib/dates.ts` (ta sama logika co w aplikacji, strefa Europe/Warsaw, bez wpisanego na sztywno miesiąca); w hero obok dużego „Załóż konto" dodatkowy link „Zaloguj się".

## Critical Implementation Details

- **User experience spec:** bez JS (przed wykonaniem skryptu) pierwszy slajd jest widoczny i karuzela przewijana dotykiem (scroll-snap); strzałki i paski to usprawnienie. Tor (`tabindex=0`) ma widoczny fokus (`focus-visible:ring-*`), obsługa ←/→, `prefers-reduced-motion` wyłącza animowane przewijanie.
- **Szerokość slajdów:** treść slajdów 2 i 3 ma się mieścić między strzałkami (strzałki 32 px + odstęp po obu stronach), więc scena karuzeli dostaje poziomy padding na strzałki; slajd 1 (telefon) jest już węższy niż scena.
- **Nachodzenie etykiet w przepływie:** pozycje etykiet kategorii w prawej kolumnie liczone z minimalnym odstępem (nazwa + kwota w drugiej linii), niezależnie od wysokości wstęg; wstęgi dochodzą do swoich węzłów.

## Phase 1: Tokeny i Topbar

### Overview

Dodać tokeny kolorów kategorii potrzebne slajdom 2 i 3 oraz usunąć zbędny link z Topbaru.

### Changes Required:

#### 1. Tokeny kategorii

**File**: `src/styles/global.css`

**Intent**: Sześć kolorów kategorii zastępuje hexy ze szkicu (Mieszkanie, Żywność, Samochód, Dzieci, Rozrywka, Inne). Pasek przychodów i „Zostaje" używają istniejącego `--success`.

**Contract**: `--category-housing|food|car|kids|fun|other` w `:root` i `.dark` (wartości `.dark` odpowiadają szkicowym #7c8cff, #a78bfa, #38bdf8, #f59e0b, #f472b6, #94a3b8 przeliczonym na `oklch`; wartości `:root` dobrane naprawdę, nie jako placeholdery: ciemniejsze odcienie o kontraście czytelnym na jasnym tle, bo jasny wygląd strony powstanie niedługo), publikacja `--color-category-*` w `@theme inline`. Opcjonalnie `@utility` na poświatę pod telefonem czytającą `--primary` (zamiast `oklch` w widoku).

#### 2. Dokumentacja tokenów

**File**: `context/changes/ui-home-page/tokens.md`

**Intent**: Tabela „co zastąpiło co" (hex ze szkicu → token) w stylu `context/archive/2026-10-15-dashboard-design-tokens/tokens.md`.

**Contract**: wiersz na token: nazwa, wartość `:root`, wartość `.dark`, zastąpiony literał.

#### 3. Topbar bez „Załóż konto"

**File**: `src/components/Topbar.astro`

**Intent**: W wariancie niezalogowanym zostaje „Zaloguj się"; duży przycisk w hero jest jedynym wejściem do rejestracji.

**Contract**: usunąć drugi `<a href="/auth/signup">` (`Topbar.astro:172-178`); wariant zalogowany bez zmian.

### Success Criteria:

#### Automated Verification:

- Lint przechodzi: `npm run lint`
- Kontrola UI przechodzi: `npm run check:ui`
- Typy przechodzą: `npx astro check`

#### Manual Verification:

- Na `/dev/dashboard-states` ekran miesiąca i istniejące tokeny bez zmian; pasek niezalogowany traci „Załóż konto", tak samo jak na `/` (strona renderuje `<Topbar />`, `dashboard-states.astro:78-82`)
- Pasek na `/` pokazuje tylko „Zaloguj się"

**Implementation Note**: After completing this phase and all automated verification passes, pause here for manual confirmation from the human that the manual testing was successful before proceeding to the next phase. Phase blocks use plain bullets — the corresponding `- [ ]` checkboxes for these items live in the `## Progress` section at the bottom of the plan.

---

## Phase 2: Karuzela

### Overview

Samodzielny komponent karuzeli z trzema slajdami, bez zależności.

### Changes Required:

#### 1. Komponent karuzeli i slajdy

**File**: `src/components/home/HeroCarousel.astro` (+ pliki slajdów w `src/components/home/`, np. `PhoneSlide.astro`, `FlowSlide.astro`, `LensSlide.astro`)

**Intent**: Odtworzyć trzy widoki ze szkicu na tokenach. Slajd 1: telefon z ekranem miesiąca i szufladą „Dodaj wydatek" (etykiety jak w `MonthScreen.tsx:58-62` i `EntrySheet.tsx`), nazwa miesiąca z `formatMonthLabel(currentMonthStart())`. Slajd 2: przepływ przychodów do kategorii i „Zostaje", węższy, kwoty w drugiej linii pod nazwą, bez nachodzenia. Slajd 3: lupa nad listą wydatków i zielony kafelek „Zostaje" z dwoma małymi kafelkami Przychody i Wydatki oddzielonymi widocznym znakiem „−". Dane przykładowe (12 500 / 8 200 / 4 300 zł) w jednym obiekcie we frontmatter, oznaczone „Dane przykładowe".

**Contract**: SVG generowane z danych; kolory wyłącznie klasami tokenów (`fill-category-*`, `fill-success`, `fill-card`, `stroke-border`, `fill-foreground`, `fill-muted-foreground`) lub `var(--…)`; brak hex/`rgb`/`oklch`/`[…px]`. Zamienniki literałów ze szkicu na istniejące tokeny: szkło lupy → `fill-popover`; tło strzałek → `bg-background/70`; tło listy → `fill-foreground/8`; pasek toru → `fill-foreground/15`; ramka telefonu → `border-secondary`; notch i scrim → `bg-background` z przezroczystością; poświata pod telefonem → wymagany `@utility` w `global.css` czytający `--primary` (nie klasa z `oklch` w widoku). Ramka, notch i scrim zakładają ciemny motyw (w jasnym `bg-background` jest białe); przy wprowadzaniu jasnego wyglądu trzeba je przejrzeć. Pliki `.astro` leżą bezpośrednio w `src/components/home/` (skaner `check:ui` nie schodzi do podkatalogów, `check-ui-tokens.mjs:29-34`). Wymiary telefonu i slajdu ze skali Tailwinda. Role i etykiety dostępności jak w szkicu (`role="region"` + `aria-roledescription="karuzela"`, slajdy jako `group` „n z 3", SVG z `role="img"` i opisem, `aria-current` na paskach, znak „−" z opisem dla czytników).

#### 2. Sterowanie

**File**: `src/components/home/HeroCarousel.astro` (`<script>`)

**Intent**: Strzałki, paski i klawisze ←/→ przewijają tor scroll-snap; indeks z `scrollLeft/clientWidth`; resize przywraca wyrównanie. Wzorzec skryptu jak `Topbar.astro:182-210`.

**Contract**: elementy interaktywne to `<button type="button">` z `aria-label`, stany default/hover/`focus-visible`; `prefers-reduced-motion` → `behavior: 'auto'`; zawsze 3 slajdy, przewijanie zapętlone jak w szkicu.

#### 3. Podpięcie na stronie i bramka UI

**File**: `scripts/check-ui-tokens.mjs`, `src/components/Welcome.astro`

**Intent**: Pauza po tej fazie ma mieć adres do oceny wizualnej, a `check:ui` ma czytać nowe pliki od razu.

**Contract**: dopisać `"src/components/home"` do `CLEAN_PATHS`; tymczasowo wstawić `<HeroCarousel />` do `Welcome.astro` (pełny układ i kopia w fazie 3).

### Success Criteria:

#### Automated Verification:

- Kontrola UI przechodzi i obejmuje nowe pliki: `npm run check:ui`
- Lint i typy przechodzą: `npm run lint && npx astro check`

#### Manual Verification:

- Slajdy 2 i 3 mieszczą się między strzałkami na 390 px i na desktopie
- Kwoty w przepływie nie nachodzą na siebie ani na etykiety sąsiednich kategorii
- W kafelku „Zostaje" widać „Przychody − Wydatki" z wyraźnym minusem
- Strzałki, paski i klawisze ←/→ działają, fokus jest widoczny

**Implementation Note**: After completing this phase and all automated verification passes, pause here for manual confirmation from the human that the manual testing was successful before proceeding to the next phase.

---

## Phase 3: Strona `/`

### Overview

Złożyć stronę: treść, układ, usunięcie kart, bramka `check:ui`.

### Changes Required:

#### 1. Welcome

**File**: `src/components/Welcome.astro`

**Intent**: Zastąpić hero i karty nowym układem. Gradientowy `h1` „Hajsownik" (klasy `from-title-from to-title-to` jak dziś), podtytuł (hasło ze szkicu), krótki opis z „kilka sekund / od razu / ile zostaje", linia „Jeden dom, wspólne dane" z marketingową wstawką o prywatności, jeden duży `Załóż konto` (`buttonVariants` default + nadpisanie geometrii przez `cn`, wzorzec z `Welcome.astro:7-11`) oraz obok niego mniejszy link „Zaloguj się" (`/auth/signin`, styl linku z tokenem `text-link`). `<Topbar />` zostaje. Usunąć tablicę `features` i karty. Kopia jest propozycją do zatwierdzenia w review i ma być jak najkrótsza.

**Contract**: układ jednokolumnowy, od `lg:` dwie kolumny (tekst + CTA po lewej, `HeroCarousel` po prawej); wszystko na klasach tokenów; stany CTA i linku logowania: default, hover (`hover:bg-primary-hover` / `hover:text-link-hover`), `focus-visible` (ring), brak `disabled/error/empty/loading` (statyczna strona).

### Success Criteria:

#### Automated Verification:

- Kontrola UI: `npm run check:ui`
- Lint i typy: `npm run lint && npx astro check`
- Build: `npm run build`

#### Manual Verification:

- Treść: nazwa aplikacji widoczna jako gradientowy nagłówek; opis i linia o prywatności akceptowane przez użytkownika
- Poniżej 1024 px jedna kolumna, od 1024 px dwie

**Implementation Note**: After completing this phase and all automated verification passes, pause here for manual confirmation from the human that the manual testing was successful before proceeding to the next phase.

---

## Phase 4: Weryfikacja

### Overview

Dowód, że strona działa i nic nie zepsuła.

### Changes Required:

#### 1. Smoke i zrzuty

**File**: `context/changes/ui-home-page/` (zrzuty i notatka weryfikacji)

**Intent**: `smoke` na podglądzie produkcyjnym oraz zrzuty Playwright `/` na ~390 px i na desktopie, plus sprawdzenie fokusu klawiatury na CTA, strzałkach, paskach i torze.

**Contract**: lista sprawdzonych stanów w notatce weryfikacji; po `build` zrestartować serwer dev i odświeżyć twardo (znana pułapka środowiska).

### Success Criteria:

#### Automated Verification:

- Smoke przechodzi: `npm run smoke` (przeciw uruchomionemu serwerowi)
- Lint, typy, build, `check:ui` przechodzą

#### Manual Verification:

- Zrzuty 390 px i desktop wyglądają zgodnie z ustaleniami (rozmiar CTA, brak nachodzenia, minus w kafelku)
- Fokus klawiaturą widoczny na wszystkich elementach interaktywnych
- Przewijanie dotykiem działa (scroll-snap) także bez JS

---

## Testing Strategy

Brak testów jednostkowych w repo dla widoków; weryfikacja to `check:ui`, lint, `astro check`, build, `smoke` (kontrakt `/` 200 i 302) oraz zrzuty i ręczne sprawdzenie stanów w Playwright.

### Manual Testing Steps:

1. Otworzyć `/` na 390 px: jedna kolumna, CTA pod opisem, karuzela pod CTA.
2. Otworzyć `/` na ≥1024 px: dwie kolumny.
3. Przejść Tab-em: Topbar → CTA → strzałka ← → tor → strzałka → → paski; fokus widoczny.
4. Przewinąć dotykiem/strzałkami wszystkie 3 slajdy.

## Performance Considerations

SVG i HTML renderowane na serwerze, ok. 20 linii JS; bez zewnętrznych bibliotek i obrazów.

## References

- Related research: `context/changes/ui-home-page/research.md`
- Szkic: `context/changes/ui-home-page/reference/hero-karuzela.html`
- Wzorzec skryptu: `src/components/Topbar.astro:182-210`; wzorzec CTA: `src/components/Welcome.astro:7-11`
- Poprzednia migracja: `context/archive/2026-10-16-home-design-tokens/`

## Progress

> Convention: `- [ ]` pending, `- [x]` done. Append ` — <commit sha>` when a step lands. Do not rename step titles. See `references/progress-format.md`.

### Phase 1: Tokeny i Topbar

#### Automated

- [x] 1.1 Lint przechodzi: `npm run lint` — 652f59f
- [x] 1.2 Kontrola UI przechodzi: `npm run check:ui` — 652f59f
- [x] 1.3 Typy przechodzą: `npx astro check` — 652f59f

#### Manual

- [x] 1.4 Na `/dev/dashboard-states` ekran miesiąca i istniejące tokeny bez zmian; pasek niezalogowany traci „Załóż konto" — 652f59f
- [x] 1.5 Pasek na `/` pokazuje tylko „Zaloguj się" — 652f59f

### Phase 2: Karuzela

#### Automated

- [x] 2.1 Kontrola UI przechodzi i obejmuje nowe pliki (`src/components/home` w `CLEAN_PATHS`): `npm run check:ui` — 2bbf973
- [x] 2.2 Lint i typy przechodzą: `npm run lint && npx astro check` — 2bbf973

#### Manual

- [x] 2.3 Slajdy 2 i 3 mieszczą się między strzałkami na 390 px i na desktopie — 2bbf973
- [x] 2.4 Kwoty w przepływie nie nachodzą na siebie ani na etykiety sąsiednich kategorii — 2bbf973
- [x] 2.5 W kafelku „Zostaje" widać „Przychody − Wydatki" z wyraźnym minusem — 2bbf973
- [x] 2.6 Strzałki, paski i klawisze ←/→ działają, fokus jest widoczny — 2bbf973

### Phase 3: Strona `/`

#### Automated

- [x] 3.1 Kontrola UI: `npm run check:ui` — bbd5e6b
- [x] 3.2 Lint i typy: `npm run lint && npx astro check` — bbd5e6b
- [x] 3.3 Build: `npm run build` — bbd5e6b

#### Manual

- [x] 3.4 Nazwa aplikacji widoczna jako gradientowy nagłówek; opis i linia o prywatności akceptowane przez użytkownika — bbd5e6b
- [x] 3.5 Poniżej 1024 px jedna kolumna, od 1024 px dwie — bbd5e6b

### Phase 4: Weryfikacja

#### Automated

- [x] 4.1 Smoke przechodzi: `npm run smoke`
- [x] 4.2 Lint, typy, build, `check:ui` przechodzą

#### Manual

- [x] 4.3 Zrzuty 390 px i desktop wyglądają zgodnie z ustaleniami
- [x] 4.4 Fokus klawiaturą widoczny na wszystkich elementach interaktywnych
- [x] 4.5 Przewijanie dotykiem działa (scroll-snap) także bez JS
