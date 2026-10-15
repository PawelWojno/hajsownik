---
date: 2026-10-15T12:57:39+02:00
researcher: Paweł Wojno
git_commit: cc067ab1b59d3ddad9ba3607580e823853421d60
branch: master
repository: Hajsownik
topic: "Audyt widoku dashboard: tokeny, współdzielone komponenty, architektura (brief /10x-ui)"
tags: [research, codebase, dashboard, design-tokens, shadcn, tailwind, ui-audit]
status: complete
last_updated: 2026-10-15
last_updated_by: Paweł Wojno
---

# Research: Audyt widoku dashboard (tokeny, komponenty, architektura)

**Date**: 2026-10-15T12:57:39+02:00
**Git Commit**: cc067ab (stan sprawdzony: czyste drzewo robocze, `master`)

## Research Question

Które fragmenty widoku `dashboard` (`src/pages/dashboard.astro` + `Topbar.astro` + `src/components/month/*`) łamią kontrakt systemu projektowego (tokeny, współdzielone komponenty, architektura) i jaki jest dowód (plik:linia, wpływ na użytkownika) dla każdego zarzutu? Brief wejściowy: 4 wstępne zarzuty z `/10x-ui`.

## Summary

- Źródło tokenów (`src/styles/global.css:5-97`) jest kompletną, ale **martwą** paletą shadcn (neutralne szarości). W sprawdzonych plikach widoku nie ma ani jednej semantycznej klasy tokenowej akcentu; kolor akcentu to `purple-*`, tło to `white/5..20`, tekst to `blue-100/*` i `white`.
- Klasa `.dark` **nie jest nigdzie nakładana** w `src/` (`grep` po `class="dark"`, `classList`, `"dark"` w `*.astro/*.tsx/*.ts` — 0 trafień). Aktywne są więc wartości `:root` (jasne). Wygląd „dark” bierze się wyłącznie z `bg-cosmic` (`global.css:113-115`, 3 hexy) i z klas literalnych.
- Skan wartości zakodowanych na sztywno na 7 plikach widoku: **54 trafienia** (Topbar 14, EntrySheet 23, MonthScreen 7, CategoryGrid 3, RecurringReminders 3, RecurringIncomeReminders 3, dashboard.astro 1).
- W `src/components/ui/` są tylko `button.tsx`, `drawer.tsx` (i `LibBadge.astro`). Brakuje `input`, `select`, `card`. `Button` jest importowany w 4 plikach widoku, ale w każdym użyciu nadpisywany klasami `bg-purple-*`.
- Ścieżka bez sesji dla `/dashboard` jest poprawna: `PROTECTED_ROUTES` w `src/middleware.ts:4` zawiera `/dashboard`, a stan „błąd wczytania” ma własny komunikat (`dashboard.astro:53-58`). Nie jest zarzutem.
- Zarzut 4 (reguła agenta): `AGENTS.md` ma jedną linię `@CLAUDE.md` (import), więc nie zawiera osobnej reguły; `CLAUDE.md` ma sekcję `## UI` zakazującą literałów kolorów, a w sprawdzonych plikach widoku nie ma reguły zachęcającej do wartości jednorazowych (`grep` „arbitrary”, `w-[` w `AGENTS.md`/`CLAUDE.md`: 0 trafień). Reguła istnieje, ale nie ma egzekwowania (brak kontroli lintera dla literałów).

## Charges

Kolejność: wpływ na użytkownika malejąco. Każdy zarzut: dowód → wpływ → proponowana faza planu.

### C1. Brakujące tokeny: kolor akcentu rozproszony po 7 plikach (Missing tokens)

- **Dowód (plik:linia):**
  - Akcent `purple-600/500`: `MonthScreen.tsx:79`, `EntrySheet.tsx:305`, `EntrySheet.tsx:486`, `RecurringReminders.tsx:44`, `RecurringIncomeReminders.tsx` (analogiczna klasa, linia 44), `CategoryGrid.tsx:27`, `Topbar.astro:26`.
  - Tekst akcentu `purple-300/100` w stanach idle/hover: `MonthScreen.tsx:90`, `EntrySheet.tsx:251`, `Topbar.astro:27,29,39,103,161,164`.
  - Gradient tytułu: `MonthScreen.tsx:46` (`from-blue-200 to-purple-200`).
  - Powierzchnie: `bg-slate-900` w `EntrySheet.tsx:51`, `Topbar.astro:60,145`; `bg-white/5|10` + `border-white/10` w `MonthScreen.tsx:57,62`, `Topbar.astro:34,128,158`, `EntrySheet.tsx:25,401`.
  - Tekst drugorzędny `blue-100/70..90`: `MonthScreen.tsx:119`, `EntrySheet.tsx:193,224,259,277,380,403,407,424,444,464`, `CategoryGrid.tsx:28`, `Topbar.astro:159`.
  - Tło: `global.css:113-115` (`#0a0e1a`, `#0f1529`, `#0a0e1a`) — literały w pliku tokenów, poza `:root/.dark`, więc nie przechodzą przez warstwę tokenów.
  - Stany semantyczne: `text-red-300`/`text-emerald-300` (`MonthScreen.tsx:67`, `EntrySheet.tsx:298`), `amber-*` w `RecurringReminders.tsx:31,54`.
- **Który token powinien to pokryć:** `primary`/`primary-foreground` (akcent), `card`/`popover` (powierzchnie), `background` (tło zamiast `bg-cosmic`), `foreground`/`muted-foreground` (tekst), `border`, `destructive`; brak tokenu dla „pozytywnej” kwoty (emerald) i „ostrzeżenia” (amber) — **nowe tokeny z parą `-foreground`** (zgodnie z `CLAUDE.md` § UI).
- **Wpływ na użytkownika:** zmiana akcentu lub kontrastu wymaga edycji kilkunastu miejsc; łatwo o niespójność (np. `hover:bg-purple-500` vs `hover:bg-white/10`) i o różne kontrasty tego samego „secondary” tekstu (`blue-100/70`, `/80`, `/90`).
- **Faza:** 2 (wartości tokenów) + 3 (podmiana w widoku).

### C2. Brakujące współdzielone komponenty: pola formularza i przyciski odtworzone z klas (Missing shared component)

- **Dowód:**
  - `fieldClass` (`EntrySheet.tsx:24-25`) odtwarza pole tekstowe z klas literalnych; użyty przez 6 pól `<input>` i 2 `<select>`: kwota `EntrySheet.tsx:196`, `383`; data `262`, `447`; opis `280`, `467`; `<select>` `227`, `427`. Każdy duplikuje się w formularzu dodawania i edycji (`EntrySheet.tsx` ma dwa niemal identyczne formularze).
  - Surowe `<button>`: `CategoryGrid.tsx:16` (kafelek kategorii, własny `focus-visible:ring-purple-400`), `EntrySheet.tsx:245` („Więcej opcji”, **bez** stylu focus-visible), `Topbar.astro:101` („Wyloguj”, **bez** focus-visible).
  - `Button` z `ui/button.tsx` (które ma `focus-visible:ring-ring/50`) jest wymuszany na klasach purple w `MonthScreen.tsx:79,90`, `EntrySheet.tsx:305,486`, `RecurringReminders.tsx:44`, `RecurringIncomeReminders.tsx:44`.
  - Katalog `src/components/ui/`: `button.tsx`, `drawer.tsx`, `LibBadge.astro` — brak `input`, `select`, `card`, `label`.
  - `ServerError.tsx:11` (komponent współdzielony z auth) zawiera własne `red-500/red-900/red-300` zamiast `destructive`; to samo zrobiono ręcznie w `dashboard.astro:55`.
- **Wpływ na użytkownika:** użytkownik klawiaturowy nie widzi fokusu na „Wyloguj” i „Więcej opcji” (brak `focus-visible`), a pola mają `focus:ring` (nie `focus-visible`) w kolorze `purple-400` zamiast tokenu `--ring`. Disabled: `Button` ma `disabled:opacity-50`, ale surowe `<button>` w `CategoryGrid` nie ma stylu disabled (formularz go nie używa — potencjalnie N/A).
- **Faza:** 1 (`npx shadcn@latest add input select card label` — tylko te użyte w widoku) + 3.

### C3. Przypadkowa architektura: ciemny motyw „na sztywno”, `.dark` martwe (Accidental architecture)

- **Dowód:**
  - `Layout.astro:21` — `<meta name="color-scheme" content="dark" />` z komentarzem „The app is dark by design”; `<html>` nie ma klasy `dark` (`Layout.astro:14-16`); `grep` po `src/` na ustawianie klasy `dark`: 0 trafień.
  - Skutek: `body { @apply bg-background text-foreground }` (`global.css:121-123`) rysuje **białe tło** (`:root --background: oklch(1 0 0)`); dashboard przykrywa je `bg-cosmic min-h-screen` (`dashboard.astro:40`). Strona poza kontenerem (np. `Banner` z `missingConfigs` w `Layout.astro:26-37`) ma jasne literały `#dbeafe` itd. (`Banner.astro:30+`).
  - `ui/drawer.tsx:41` używa `bg-background` (jasne w `:root`), dlatego `EntrySheet.tsx:51` musi go nadpisywać `bg-slate-900 text-white` — dowód, że komponent z DS jest łamany lokalnie.
  - `[color-scheme:dark]` jako klasa arbitralna w `EntrySheet.tsx:272,456` — kompensuje brak globalnego `color-scheme` w tokenach.
  - `<option className="text-black">` (`EntrySheet.tsx:236,436`) — lokalna łatka kontrastu.
  - Gradient tytułu (`MonthScreen.tsx:46`) był już raz przyczyną regresji (komentarz `Layout.astro:19-20`: „turned the gradient titles navy”) — kruchy wzorzec zależny od `color-scheme`.
- **Co nie jest zarzutem:** wejście bez sesji — `middleware.ts:4,20` przekierowuje `/dashboard`; błąd danych miesiąca ma stan (`dashboard.astro:53-58`, `role="alert"`). Pusty stan: brak kategorii/danych daje sumy 0 (nie sprawdzane wizualnie; do bramki wizualnej).
- **Wpływ na użytkownika:** przy każdej zmianie motywu/przeglądarki z auto-dark (Samsung Internet, Chrome Android) widok może wyglądać inaczej (już zdarzyło się); nowy komponent z DS (`Drawer`, `Button` default) domyślnie wychodzi jasny na ciemnej stronie.
- **Wymaga decyzji w planie (zob. Open Questions):** ciemne wartości w `:root` vs klasa `dark` na `<html>`.
- **Faza:** 2.

### C4. Reguła agenta bez egzekwowania (Accidental architecture — rule)

- **Dowód:** `CLAUDE.md` § UI zabrania literałów kolorów i nakazuje tokeny; 54 trafienia skanu w widoku dowodzą, że reguła nie jest egzekwowana. `AGENTS.md` = `@CLAUDE.md` (jeden plik reguł do rozszerzenia). W `package.json`/ESLint brak sprawdzonej tu reguły blokującej klasy palety (nie sprawdzano konfiguracji ESLint poza `CLAUDE.md`; zob. Open Questions).
- **Wpływ na użytkownika (pośredni):** każdy kolejny widok kopiuje dryf. Palety `purple-`/`blue-100`/`white/10`/`slate-900` występują także w 18 plikach poza widokiem (m.in. `history`, `settings`, `auth`) — dryf już się powielił.
- **Faza:** 6 (reguła + kontrola ograniczona do oczyszczonych plików).

### Zarzuty odroczone (deferred)

- **D1.** 18 plików poza widokiem `dashboard` używających palety (`src/components/history/*`, `settings/*`, `auth/*`, `pages/auth/*`, `pages/history.astro`, `pages/settings/recurring.astro`, `Welcome.astro`, `ui/LibBadge.astro`) — poza zakresem „jeden widok” (`change.md`). Zmiana globalnych tokenów (np. `--primary`) **zmieni wygląd `Button` default w tych widokach** — do sprawdzenia wizualnie w fazie 2.
- **D2.** `Banner.astro` — hexy w `<style>` (jasne warianty); to komponent globalny, nie widok dashboard.
- **D3.** Dekoracyjny gradient tytułu (`MonthScreen.tsx:46`): decyzja, czy zachować jako efekt (wtedy dwa tokeny), czy uprościć do `text-foreground` — decyzja projektowa w planie.

## Code References

- `src/styles/global.css:5-97` — `:root`, `.dark`, `@theme inline` (kompletna paleta shadcn, neutralna).
- `src/styles/global.css:113-115` — `@utility bg-cosmic` z 3 hexami.
- `src/layouts/Layout.astro:21` — `color-scheme: dark`, brak klasy `dark` na `<html>`.
- `src/pages/dashboard.astro:40,53-58` — wrapper `bg-cosmic`, blok błędu z literałami `red-*`.
- `src/components/month/MonthScreen.tsx:46,57,67,79,90,119` — gradient, karta sum, kolory kwot, przyciski.
- `src/components/month/EntrySheet.tsx:24-25,51,196-280,305,383-467,486` — `fieldClass`, drawer, pola, przyciski.
- `src/components/month/CategoryGrid.tsx:16-29` — surowy `<button>` z własnym focus.
- `src/components/Topbar.astro:25-29,34,60,101,128,145,158-164` — klasy aktywne/idle, surowy przycisk wylogowania.
- `src/components/month/RecurringReminders.tsx:31,44,54` (analogicznie `RecurringIncomeReminders.tsx`) — `amber-*`, `purple-*`.
- `src/components/auth/ServerError.tsx:11` — `red-*` współdzielone z auth.
- `src/components/ui/button.tsx:8-36`, `ui/drawer.tsx:26,41,50` — komponenty DS używające tokenów.
- `src/middleware.ts:4,20` — guard wejścia na `/dashboard`.

## Architecture Insights

- Wariant kontraktu: **świeży starter z martwym plikiem tokenów** — tokeny i `Button`/`Drawer` istnieją, widok ich nie czyta; faza 1 ma podpiąć widok pod tokeny, nie wybierać motywu.
- `@theme inline` poprawnie publikuje `--color-*`, więc `bg-primary`, `bg-card`, `text-muted-foreground` działają bez zmian w mechanizmie; wystarczy zmienić wartości.
- Aplikacja jest ciemna z założenia, a system tokenów ma jasne `:root` i `.dark`. Najprostsze spójne rozwiązanie to jedna ciemna paleta wartości w warstwie tokenów (decyzja w planie), bez przełącznika motywu.
- Zmiana `--primary` jest globalna: `Button` (default) używają też inne widoki (nie sprawdzano wszystkich wywołań).

## Historical Context (from prior changes)

- `context/archive/2026-10-09-category-management/plan.md:182` — plan nakazywał „komponenty z `src/components/ui`” i `cn()`; dashboard (wcześniejszy slice) tego nie respektuje, czyli reguła dotyczyła tylko późniejszych widoków.
- Poprzednie zmiany (`first-expense-and-income`, `expense-history-and-edits`) nie zawierają decyzji o tokenach/motywie (przeszukano `plan.md`/`research.md` w `context/archive/*` pod „token”, „dark mode”, „palet”: bez trafień dotyczących motywu).

## Related Research

Brak (poprzednie `research.md` w `context/archive/**` dotyczą auth, rekurencji, historii).

## Open Questions

1. **Ciemne wartości: w `:root` czy przez `class="dark"` na `<html>`?** Wpływa na `Drawer`, `Banner`, inne widoki (D1). Rekomendacja do planu: sprawdzić, które inne widoki czytają `bg-background`/`text-foreground` (nie sprawdzono), i wybrać wariant o mniejszym zasięgu.
2. **Czy `--primary` ma być fioletowy (`purple-600` jako oklch) zamiast neutralnego szarego?** To decyzja wizualna uczestnika; wpływa na `Button` default w auth/settings.
3. **Czy repo ma ESLint z regułą na klasy palety?** Konfiguracja ESLint nie była czytana w tym badaniu; do sprawdzenia w fazie 6 przed wyborem formy kontroli (zgodnie z wymogiem „nowa zależność lint = decyzja uczestnika”).
4. **Stany empty/loading widoku** (brak wydatków, pending zapisu, `aria-live` sum) nie były renderowane w przeglądarce w tym badaniu; wymagają zrzutów w fazie stanów.
