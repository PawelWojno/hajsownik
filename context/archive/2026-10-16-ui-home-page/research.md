---
date: 2026-10-17T00:02:32+02:00
researcher: Claude (claude-sonnet-5-5)
git_commit: efdbfa9998ddd39dc139b11a6f7986440ba8194c
branch: master
repository: hajsownik
topic: "Projekt strony startowej: szkic hero-karuzela.html kontra obecna strona `/`"
tags: [research, codebase, welcome, index, hero, carousel, design-tokens, ui]
status: complete
last_updated: 2026-10-17
last_updated_by: Claude (claude-sonnet-5-5)
---

# Research: Projekt strony startowej

**Date**: 2026-10-17T00:02:32+02:00
**Researcher**: Claude (claude-sonnet-5-5)
**Git Commit**: efdbfa9998ddd39dc139b11a6f7986440ba8194c
**Branch**: master (kod nietknięty)
**Repository**: hajsownik

## Research Question

Jak przenieść szkic `context/changes/ui-home-page/reference/hero-karuzela.html` na stronę `/` (`src/pages/index.astro` + `src/components/Welcome.astro`) zgodnie z kontraktem UI repozytorium? Co w szkicu pokrywa się z tokenami i komponentami, co je łamie, i co plan musi rozstrzygnąć?

Badanie lokalne (jeden widok, kilka plików), bez podagentów. Niczego nie uruchamiano w przeglądarce ani nie renderowano szkicu; wygląd i zachowanie karuzeli pozostają do sprawdzenia w implementacji.

## Summary

- **Stan wyjściowy:** strona `/` jest już na tokenach (zmiana `home-design-tokens`, zarchiwizowana). `Welcome.astro` ma `bg-cosmic`, `Topbar`, hero z tytułem „Hajsownik", dwa CTA przez `buttonVariants` i trzy karty funkcji (`Welcome.astro:33-81`). `index.astro` tylko renderuje `<Welcome />` (`index.astro:6-8`). Stary audyt `context/archive/2026-10-16-home-design-tokens/research.md` opisuje stan *sprzed* tej migracji (literały palety, `Welcome.astro:7-14`) i jest już nieaktualny co do kodu.
- **Szkic to nowy projekt układu, nie migracja:** nagłówek „Wiesz, ile zostaje w tym miesiącu.", karuzela 3 slajdów (telefon z formularzem, przepływ pieniędzy, lupa nad listą) i jeden duży CTA „Załóż konto" z linkiem „Zaloguj się". Karty funkcji ze szkicu nie ma.
- **Tokeny w szkicu są zgodne z `.dark`:** wszystkie 15 zmiennych w `hero-karuzela.html:9-24` ma identyczne wartości jak `.dark` w `global.css:54-99`; rozbieżności nie znaleziono w tym zbiorze.
- **Szkic łamie kontrakt `check:ui` w trzech miejscach:** (1) hex w SVG slajdu 2 i 3 (`#2dd4bf`, `#7c8cff`, `#a78bfa`, `#38bdf8`, `#f59e0b`, `#f472b6`, `#94a3b8`), (2) literały `oklch(...)` w CSS i SVG, (3) wartości arbitralne w px (`620px`, `290px`, `28px`...). `Welcome.astro` i `index.astro` są w `CLEAN_PATHS` (`check-ui-tokens.mjs:12-13`), więc przeniesienie 1:1 blokuje `npm run check:ui` i hook pre-commit.
- **Największa decyzja dla planu:** skąd wziąć kolory kategorii/przepływu (7 hexów) i czy karuzela ma być w Astro + `<script>`, czy w React (island). Zob. Open Questions.

## Detailed Findings

### C1. Stan obecnej strony `/` (punkt wyjścia)

- `Welcome.astro:33` `bg-cosmic relative min-h-screen`; `Welcome.astro:35` `<Topbar />`; hero `:38-53` (h1 `from-title-from to-title-to`, tekst `text-muted-foreground`, dwa `<a>` z `buttonVariants` + `cn`, `Welcome.astro:7-11`); karty `:56-79` (`Card`, `text-link` dla ikon).
- Skan regexem `check:ui` (`check-ui-tokens.mjs:22-27`) po `Welcome.astro` i `index.astro` nie był tu powtarzany; plik jest na liście `CLEAN_PATHS`, a ostatni commit zamknął zmianę jako zielony (`git log`: `efdbfa9 chore(archive): close home-design-tokens`).
- Smoke: `scripts/smoke.mjs:111` oczekuje `/` → 200 dla anonima, `:215` oczekuje 302 → `/dashboard` dla zalogowanego. Oba kontrakty zostają, o ile `index.astro` nie zmieni trasy ani middleware.
- Middleware: `/` jest w `SIGNED_OUT_ONLY_ROUTES` (`middleware.ts:6,26-27`), więc nowa strona jest wyłącznie dla niezalogowanych; dane w slajdach muszą być statyczne (przykładowe), bez zapytań do bazy.

### C2. Zgodność szkicu z tokenami

- Szkic deklaruje tokeny „skopiowane z `src/styles/global.css` (tryb ciemny)" (`hero-karuzela.html:8`) i używa ich przez `var(--…)`: `--background`, `--cosmic-mid`, `--foreground`, `--card`, `--popover`, `--border`, `--input`, `--muted-foreground`, `--primary`, `--primary-hover`, `--ring`, `--success`, `--title-from`, `--title-to`, `--link` (15 zmiennych; wartości porównane z `.dark` w `global.css:54-99`, zgodne).
- Odwzorowanie w Tailwind (z `@theme inline`, `global.css:101-149`): `bg-card`, `border-border`, `text-muted-foreground`, `bg-primary hover:bg-primary-hover`, `text-success`, `text-link`, `ring-ring`, `bg-popover`, `border-input`, `from-title-from to-title-to`, `bg-cosmic`.
- **Tło `body`:** szkic maluje gradient na `body` z `--background`/`--cosmic-mid`; w repo ten sam efekt daje `@utility bg-cosmic` (`global.css:151-153`, używa `--cosmic-edge`, a nie `--background`; obie wartości są takie same w `.dark`: `global.css:56,84`). Nie trzeba nowego tokenu.
- **Kolory bez tokenu w szkicu** (łamią kontrakt):
  - Hex w SVG: slajd 2 (`hero-karuzela.html:185`) `#2dd4bf` (pasek przychodów), `#7c8cff`, `#a78bfa`, `#38bdf8`, `#f59e0b`, `#f472b6`, `#94a3b8` (kategorie); slajd 3 (`:186`) te same kolory kategorii plus gradient lupy `#7c8cff → #a78bfa`.
  - Literały `oklch()` w CSS: `.slide:first-child` poświata (`:53`), `.svg-slide .listbg/.glass/.okbox/.track-bar` (`:56-59`), `.nav` (`:66`), `.btn.primary` cień (`:82`), `.phone` ramka/notch (`:99,104`), `.scrim` (`:115`).
  - `color: #fff` (`:82,126,127`) zamiast `text-primary-foreground`.
  - Arbitralne rozmiary px: `620px`, `420px`, `290px`, `76px`, `44px`/`9px` ramka telefonu i inne (`:47,51,98-99`).
- Istniejące tokeny `--chart-1…5` (`global.css:86-90`, `.dark`) mają 5 wartości; szkic potrzebuje 6 kolorów kategorii + „Zostaje" (zielony = `--success`). Mapowanie 6→5 jest niejednoznaczne; to decyzja planu (nowe tokeny `category-*` w `:root` i `.dark` wg `lessons.md`: „Jasny motyw (:root) trzeba utrzymywać razem z ciemnym").

### C3. Reużycie istniejących komponentów

- `ui/button.tsx` (`buttonVariants` eksportowane, `button.tsx:50`) już obsługuje CTA w `Welcome.astro:7-11` (wzorzec: `cn(buttonVariants(...), geometria)`). Szkicowy CTA `.btn.primary` (`min-height: 58px; padding: 0 40px; font-size: 19px; border-radius: 14px`) jest większy niż `size: lg` (`h-10 px-6`, `button.tsx:24`); trzeba nadpisać klasami jak dziś w `Welcome.astro:9`. Wariant `link` istnieje (`button.tsx:19`), ale ma `text-primary`, nie `text-link`; szkicowy „Zaloguj się" (`.btn.outline`, kolor `--link`) pasuje bliżej do `ghost` + `text-link` albo zwykłego linku jak w `Topbar.astro:166-170`.
- `ui/card.tsx` ma `bg-card rounded-xl border` (`Welcome.astro:58` używa go z `gap-0 p-6 shadow-none backdrop-blur-xl`). Panele slajdów 2 i 3 (`.svg-slide .panel`: `fill: var(--card); stroke: var(--border)`) odpowiadają `bg-card border-border`.
- `Topbar.astro:162-179` (wariant niezalogowany) pokazuje „Niezalogowano" + linki „Zaloguj się"/„Załóż konto". Szkic ma własny pasek (`hero-karuzela.html:145-148`: marka „Hajsownik" z gradientem + link „Zaloguj się") i **nie ma** „Niezalogowano". Jeśli nowa strona zastąpi `<Topbar />` własnym paskiem, odpada też powielenie linków, które poprzedni audyt oznaczył jako D1 (C5 starego research). Wariant niezalogowany `Topbar` byłby wtedy używany tylko na `/dev/*` (sprawdzone użycia `<Topbar />` w poprzednim audycie: `dashboard`, `history`, `settings/*` są chronione, `middleware.ts:4`; nie powtarzano grepa).
- Brak istniejącego komponentu karuzeli/slajdów w `src/components/**` (lista komponentów: `ui/`, `auth/`, `month/`, `history/`, `settings/`, `dev/`, `Banner`, `Topbar`, `Welcome`).

### C4. Karuzela: zachowanie i dostępność w szkicu

- Mechanizm: `overflow-x: auto; scroll-snap-type: x mandatory` (`hero-karuzela.html:49`), przyciski prev/next, trzy paski-wskaźniki, skrypt ~20 linii (`:205-228`): indeks z `scrollLeft/clientWidth`, `scrollTo`, klawisze ←/→ na `#track` (`tabindex="0"`), `resize` re-snap.
- Dostępność w szkicu: `role="region"` + `aria-roledescription="karuzela"`, slajdy z `role="group"` i etykietą „n z 3", SVG z `role="img"` + `aria-label`, `aria-current` na paskach, `prefers-reduced-motion` uwzględnione (`:74,215`). Fokus: `.nav:focus-visible, .bar:focus-visible` (`:68`), a sam `.track` ma `outline-offset: 4px` (`:49`) bez jawnego stylu fokusu (domyślny obrys przeglądarki; nie sprawdzano w przeglądarce).
- Brak autoodtwarzania (nic w skrypcie nie ustawia timera), więc wymóg pauzy dla ruchu automatycznego nie dotyczy.
- Zawartość slajdu 1 (telefon) odtwarza prawdziwe etykiety aplikacji: „Przychody", „Wydatki", „Zostaje" (`MonthScreen.tsx:58-62`), „Dodaj wydatek", „Kwota", „Kategoria", „Zapisz" (`EntrySheet.tsx:70,194,406,306`). Etykietę miesiąca ustawia skrypt przez `Intl.DateTimeFormat('pl-PL')` (`hero-karuzela.html:209`) — działa po stronie klienta; SSR wyśle stałe „Październik 2026", które po hydracji zmieni się (ryzyko migotania, do oceny).
- Slajdy 2 i 3 to ręcznie wyliczone ścieżki SVG (współrzędne w atrybutach `d`, `hero-karuzela.html:185-186`). Dane przykładowe: przychody 12 500 zł, wydatki 8 200 zł, zostaje 4 300 zł (spójne we wszystkich 3 slajdach; 3000+2000+1400+900+500+400 = 8200).

### C5. Układ i responsywność

- Układ mobile-first, siatka z obszarami `"text" "cta" "phone"` (`hero-karuzela.html:44`); od `min-width: 900px` dwie kolumny `minmax(0,1fr) 420px` z obszarami `"text phone" "cta phone"` (`:129-131`). Tailwind ma domyślny breakpoint `lg` = 1024 px, `md` = 768 px; **900 px nie odpowiada żadnemu domyślnemu breakpointowi** (do decyzji: `lg`/`md` albo `min-[900px]`, ale ta ostatnia to wartość arbitralna łamiąca regex `-\[[0-9.]+(px|rem)\]` tylko w formie `-[…px]`; `min-[900px]` jej nie łapie, wg wzorca `check-ui-tokens.mjs:26`, ale narusza ducha reguły).
- Ten sam układ w `Welcome.astro` dziś: wyśrodkowany `max-w-4xl` w jednej kolumnie (`Welcome.astro:38`), więc zmiana jest zmianą struktury, nie samej skóry.
- Nagłówek obecny: `h1` „Hajsownik" (`Welcome.astro:39-41`); szkic: `h1` „Wiesz, ile zostaje w tym miesiącu." z marką w pasku (`hero-karuzela.html:146,152`). Zmiana treści, nie tylko stylu. Reguła `short-ui-copy` z pamięci użytkownika: teksty krótkie; ostateczna kopia po stronie decyzji użytkownika.

### C6. Wymagania procesowe z CLAUDE.md i weryfikacja

- Kontrakt: żadnych palet/hex/oklch/arbitralnych px w widoku, nowe kolory jako tokeny w `global.css` z wartością w `:root` i `.dark` oraz publikacją w `@theme inline`; zmiana tokenów logowana w `tokens.md` zmiany (`CLAUDE.md`, „UI").
- Stany: tu istotne default/hover/focus-visible na CTA, strzałkach, paskach i torze karuzeli; `disabled/error/empty/loading` raczej N/A (statyczna zawartość), ale karuzela bez JS (SSR, przed hydracją) musi nadal pokazywać slajd 1 i być przewijalna dotykiem.
- Wizualna bramka: Playwright, zrzut desktop i ~390 px (`CLAUDE.md`). Strona `/dev/dashboard-states` dotyczy dashboardu; dla `/` osobna strona stanów prawdopodobnie zbędna (zawartość statyczna), do uzasadnienia w planie.
- Po zmianie dopisać `Welcome.astro`/nowe komponenty do `CLEAN_PATHS` (nowe pliki lub katalog), bo lista jest jedynym źródłem kontroli (`check-ui-tokens.mjs:7,11-20`).

## Code References

- `context/changes/ui-home-page/reference/hero-karuzela.html:9-25` — tokeny szkicu (zgodne z `.dark`).
- `context/changes/ui-home-page/reference/hero-karuzela.html:49-69,129-131` — mechanika scroll-snap, strzałki, układ 2-kolumnowy od 900 px.
- `context/changes/ui-home-page/reference/hero-karuzela.html:185-186` — SVG slajdów 2 i 3 z hexami.
- `context/changes/ui-home-page/reference/hero-karuzela.html:205-228` — skrypt karuzeli i etykiety miesiąca.
- `src/pages/index.astro:6-8` — `<Layout><Welcome /></Layout>`.
- `src/components/Welcome.astro:7-11,33-81` — obecne CTA (`buttonVariants`+`cn`) i karty funkcji.
- `src/components/Topbar.astro:162-179` — wariant niezalogowany (powiela linki hero).
- `src/components/ui/button.tsx:12,15-16,19,24,50` — warianty, rozmiar `lg`, eksport `buttonVariants`.
- `src/styles/global.css:54-99,86-90,101-149,151-153` — `.dark`, `--chart-*`, `@theme inline`, `bg-cosmic`.
- `scripts/check-ui-tokens.mjs:11-27` — `CLEAN_PATHS` i regex.
- `scripts/smoke.mjs:111,215` — kontrakt `/` dla anonima i zalogowanego.
- `src/middleware.ts:6,26-27` — `/` tylko dla niezalogowanych.
- `src/layouts/Layout.astro:14,18` — `<html class="dark">`, viewport z `interactive-widget`.

## Architecture Insights

- Wariant `10x-ui`: istniejący system projektowy; rozszerzamy tokeny i komponenty, nie inicjujemy ponownie shadcn.
- Precedens dla dekoracji/tła: `@utility` czytające tokeny (`bg-cosmic`); to samo da się zrobić dla poświaty slajdu 1 i ramki telefonu, jeśli są potrzebne.
- Repozytorium trzyma interaktywność w React-islandach (`src/components/month/*`), a statykę w Astro; karuzela z ~20 liniami JS to granica: `<script>` w Astro (jak w `Topbar.astro:182-210`) albo island React z hookiem w `src/hooks/` (reguła z `CLAUDE.md`).
- SVG ze stałymi współrzędnymi można wyrenderować z danych w frontmatter Astro (kolory przez `fill="var(--…)"`/klasy `fill-*` Tailwind z tokenów), bez hexów w markupie.

## Historical Context (from prior changes)

- `context/archive/2026-10-16-home-design-tokens/` — migracja `/` na tokeny (stan, od którego startujemy); jej research jest nieaktualny co do kodu, aktualny co do zasad (gradient `title-from/to`, `lessons.md`, `rounded-2xl` poza kontrolą).
- `context/archive/2026-10-16-home-design-tokens/research.md` D1 — powielenie linków w `Topbar` na `/` odroczone; ta zmiana może je rozwiązać (C3).
- `context/archive/2026-10-15-dashboard-design-tokens/tokens.md` — tabela „co zastąpiło co"; wzór dla `tokens.md` tej zmiany, jeśli powstaną nowe tokeny.
- `context/foundation/lessons.md` — reguła `:root` razem z `.dark` (dotyczy każdego nowego tokenu kategorii).

## Related Research

- `context/archive/2026-10-16-home-design-tokens/research.md`, `context/archive/2026-10-15-dashboard-design-tokens/research.md`.

## Open Questions

1. **Kolory kategorii i przepływu (C2):** nowe tokeny `category-*` (6 wartości; `:root` + `.dark` + `@theme inline`) czy mapowanie na `--chart-1…5` + `--success`/`--primary`? Szkicowe hexy to paleta Tailwind (indigo/violet/sky/amber/pink/slate/teal); odwzorowanie 1:1 wymaga nowych tokenów.
2. **Technologia karuzeli:** `<script>` w Astro (SSR, zero hydratacji, jak `Topbar`) czy island React + hook w `src/hooks/`. Wpływa na SSR slajdu 1 i etykietę miesiąca (C4).
3. **Etykieta miesiąca:** statyczna z SSR (render po stronie serwera w `Europe/Warsaw`) czy ustawiana skryptem jak w szkicu — SSR jest prostszy i bez migotania.
4. **Topbar na `/`:** zastąpić własnym paskiem ze szkicu (marka + „Zaloguj się") i tym samym zamknąć D1 z poprzedniej zmiany, czy zostawić `<Topbar />`.
5. **Karty funkcji:** szkic ich nie ma; usunąć trzy karty (`Welcome.astro:56-79`) czy zostawić pod hero.
6. **Breakpoint 900 px:** `lg` (1024), `md` (768) czy arbitralny `min-[900px]`.
7. **Telefon i SVG (arbitralne px):** ramka telefonu 290×620 i wysokość slajdu 620 wymagają skali Tailwind (`w-72`, `h-155`…) albo `@utility`; slajdy 2/3 z `viewBox 360×620` skalują się same, więc piksele siedzą tylko w `viewBox`/współrzędnych (nie są klasami Tailwind).
8. **Treść:** nagłówek i podtytuł szkicu to nowa kopia (C5); zatwierdza użytkownik, zgodnie z regułą krótkich tekstów.
9. **Weryfikacja:** potwierdzić w przeglądarce fokus na torze karuzeli (`tabindex=0`), zachowanie scroll-snap na dotyku i wygląd na 390 px / desktop (Playwright).
