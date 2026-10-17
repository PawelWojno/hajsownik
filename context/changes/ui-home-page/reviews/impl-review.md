<!-- IMPL-REVIEW-REPORT -->
# Implementation Review: Projekt strony startowej

- **Plan**: context/changes/ui-home-page/plan.md
- **Scope**: Full plan
- **Reviewed phases**: 1, 2, 3, 4
- **Date**: 2026-10-17
- **Verdict**: NEEDS ATTENTION
- **Findings**: 0 critical  4 warnings  4 observations

## Verdicts

| Dimension | Verdict |
|-----------|---------|
| Plan Adherence | PASS |
| Scope Discipline | PASS |
| Safety & Quality | WARNING |
| Architecture | PASS |
| Pattern Consistency | WARNING |
| Success Criteria | PASS |

## Verification

- `npm run check:ui`: PASS (16 plików czystych)
- `npm run lint`: PASS
- `npx astro check`: PASS (0 błędów, 0 ostrzeżeń, 0 wskazówek)
- `npm run build` i `npm run smoke` (lokalny Supabase): PASS w fazach 3 i 4 (po ostatnim commicie kodu nie zmieniał się nic poza dokumentacją zmiany)
- Progress: 21/21 `[x]`, wszystkie wiersze z SHA; ręczne 4.3–4.5 potwierdzone przez użytkownika, zrzuty w `screens/`

## Findings

### F1 — Telefon na slajdzie 1 jest przycięty na wąskich ekranach

- **Severity**: ⚠️ WARNING
- **Impact**: 🔎 MEDIUM — real tradeoff; pause to reason through it
- **Dimension**: Safety & Quality
- **Location**: src/components/home/PhoneSlide.astro:21, src/components/home/HeroCarousel.astro:21-23
- **Detail**: Telefon ma stałe `w-64` (256 px), a szerokość slajdu to szerokość okna minus 64 px (paddingi `Welcome`) minus 80 px (`px-10` na strzałki). Zmierzone w przeglądarce przy 320 px: slajd 161 px, telefon 256 px, czyli po 47 px przycięte z każdej strony (`overflow-x-auto` na torze). Przy 390 px nadmiar to kilka pikseli na stronę (na zrzucie 390 px niewidoczny), przy 360 px będzie wyraźny. Strona nie ma poziomego przewijania (`docOverflow: false`), więc problem jest tylko w obrębie karuzeli.
- **Fix A ⭐ Recommended**: Telefon `w-full max-w-64` (szerokość od slajdu), z zachowaniem proporcji wysokości
  - Strength: Naprawia przycinanie od 320 px bez zmiany układu strzałek; telefon nadal ma 256 px tam, gdzie jest miejsce.
  - Tradeoff: Przy ~160 px szerokości zawartość ekranu (karta miesiąca, szuflada z kategoriami) robi się ciasna i trzeba ją sprawdzić na 320 i 360 px.
  - Confidence: MEDIUM — pomiar pokazuje przyczynę, ale zagęszczenia zawartości nie widziałem.
  - Blind spot: Nie sprawdzano 360 px ani zawartości szuflady przy ~160 px.
- **Fix B**: Zmniejszyć boczne marginesy na mobile (strzałki nakładane na krawędź slajdu zamiast `px-10`)
  - Strength: Telefon dostaje ok. 40 px więcej szerokości bez zmiany jego rozmiaru.
  - Tradeoff: Strzałki mogą zasłaniać brzegi slajdów 2 i 3 (to było powodem `px-10`).
  - Confidence: LOW — wymaga ponownej oceny slajdów 2 i 3.
  - Blind spot: Zasłanianie treści przez strzałki.
- **Decision**: FIXED via Fix A (telefon w-full max-w-64) + siatka kategorii 2 kolumny w wąskim telefonie (@container + wariant @phone-wide z --container-phone-wide: 14rem; pierwotna klasa @min-56 nie generowała CSS i została zastąpiona); sprawdzone 360 i 390 px (bez wystających etykiet); przy 320 px wystaje jeszcze etykieta "Mieszkanie" (bardzo rzadka szerokość, świadomie zostawione)

### F2 — Strzałki i paski są aktywnymi przyciskami także bez JS

- **Severity**: ⚠️ WARNING
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Safety & Quality
- **Location**: src/components/home/HeroCarousel.astro:24, 63, 80-92
- **Detail**: Komentarz przy torze obiecuje fallback bez JS (przewijany dotykiem pas), ale strzałki i trzy paski są renderowane jako fokusowalne przyciski, które bez skryptu nic nie robią. Czytniki ekranu ogłaszają je jako sterowanie.
- **Fix**: Ukryć je domyślnie (`hidden`) i odkrywać ze skryptu (np. atrybut `data-js` na korzeniu).

- **Decision**: FIXED — strzałki i paski mają `hidden data-carousel-control`, skrypt je odkrywa po starcie (sprawdzone: z JS display flex, z `hidden` display none)

### F3 — Tor z `tabindex="0"` nie ma nazwy dostępnej

- **Severity**: ⚠️ WARNING
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Safety & Quality
- **Location**: src/components/home/HeroCarousel.astro:43-50
- **Detail**: Fokusowalny, przewijany tor nie ma roli ani `aria-label`, więc czytnik zapowiada nienazwany element. `aria-roledescription="karuzela"` jest na zewnętrznym kontenerze, ale nie na torze.
- **Fix**: Dodać na torze `role="group"` i `aria-label="Slajdy"`.

- **Decision**: FIXED — tor ma `role="group"` i `aria-label="Slajdy"`

### F4 — Ręcznie zbudowane karty i zduplikowane helpery

- **Severity**: ⚠️ WARNING
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Pattern Consistency
- **Location**: src/components/home/FlowSlide.astro:47, src/components/home/LensSlide.astro:25, src/components/home/PhoneSlide.astro:8-9
- **Detail**: CLAUDE.md każe sprawdzić `src/components/ui/` przed pisaniem własnej karty. `PhoneSlide` używa `Card`, ale `FlowSlide` i `LensSlide` mają ręczne `border-border bg-card … rounded-3xl border p-4`. Wielkie litery miesiąca (`charAt(0).toUpperCase() + slice(1)`) są skopiowane z `dashboard.astro:35` i `history.astro:33`, a ciąg `focusClass` powtarza się w `Topbar.astro`, `Welcome.astro` i `HeroCarousel.astro`.
- **Fix**: Użyć `Card` w obu slajdach; wydzielić `formatMonthTitle` do `src/lib/dates.ts` (opcjonalnie wspólny `focusClass`).

- **Decision**: FIXED — `Card` w FlowSlide i LensSlide, `formatMonthTitle` w `src/lib/dates.ts` (dashboard, history, PhoneSlide); `focusClass` zostaje bez zmian (świadomie, trzy pliki, jedna linia)

### F5 — Skrypt karuzeli liczy indeks z pozycji przewinięcia

- **Severity**: 💡 OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Safety & Quality
- **Location**: src/components/home/HeroCarousel.astro:106-111, 132-140
- **Detail**: `index()` to `Math.round(scrollLeft / clientWidth)`. Podczas płynnego przewijania szybki drugi klik czyta pośredni indeks i może pominąć lub powtórzyć slajd; przy `clientWidth === 0` (ukryty kontener) wynik to NaN. Przy resize `sync()` może przeliczyć `current` z nową szerokością zanim zadziała uchwyt `resize`. Dziś bez ClientRouter i z jednym egzemplarzem to nie boli.
- **Fix**: Dodać `if (!track.clientWidth) return` w `go()`/`index()` i trzymać docelowy indeks w `current` do końca przewijania.

- **Decision**: FIXED — `current` jako docelowy indeks, `pending` dla trwającego przewijania, guard na `clientWidth`, flaga `resizing` (sprawdzone: podwójne kliknięcie 0→2, pętla w obie strony, ←/→ i paski)

### F6 — Zaburzona hierarchia nagłówków

- **Severity**: 💡 OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Safety & Quality
- **Location**: src/components/Welcome.astro:27, src/components/home/FlowSlide.astro:48, src/components/home/LensSlide.astro:26
- **Detail**: Kolejność to `h1` → `h3` (slajdy 2 i 3), pomijając `h2` (nagłówek `h2` slajdu 1 jest w `role="img"`, czytnik go nie widzi).
- **Fix**: Zamienić tytuły slajdów na `<p class="…font-bold">` albo `h2`.

- **Decision**: FIXED — tytuły slajdów 2 i 3 jako `<p>` z tymi samymi klasami (wygląd bez zmian)

### F7 — Promienie ze skali i właściwość arbitralna poza kontrolą `check:ui`

- **Severity**: 💡 OBSERVATION
- **Impact**: 🔎 MEDIUM — real tradeoff; pause to reason through it
- **Dimension**: Pattern Consistency
- **Location**: src/components/home/HeroCarousel.astro:47, PhoneSlide.astro:21,30,48, FlowSlide.astro:47, LensSlide.astro:25,82
- **Detail**: Użyte `rounded-2xl|3xl|4xl` nie podążają za `--radius` (CLAUDE.md przyznaje, że kontrola ich jeszcze nie obejmuje), a `[scrollbar-width:none] [&::-webkit-scrollbar]:hidden` to właściwości arbitralne. Przy ramce telefonu to uzasadnione odstępstwo, ale nie ma na to tokenu.
- **Fix A ⭐ Recommended**: Zostawić, a w `tokens.md` zapisać świadome odstępstwo (ramka telefonu i panele slajdów); ukrywanie paska przewijania wynieść do `@utility no-scrollbar` w `global.css`
  - Strength: Zero zmian wyglądu, reguła z CLAUDE.md zostaje uczciwa (odstępstwo jest nazwane).
  - Tradeoff: Skala promieni nadal nie jest tokenem, więc przy zmianie `--radius` te elementy nie podążą.
  - Confidence: MEDIUM — wynika z zapisu w CLAUDE.md, nie z weryfikacji wyglądu po zmianie.
  - Blind spot: Nie sprawdzano, jak bardzo `rounded-3xl` różni się od `rounded-xl` na zrzutach.
- **Fix B**: Zamienić na `rounded-xl` / `rounded-lg`
  - Strength: Pełna zgodność z `--radius`.
  - Tradeoff: Wyraźnie mniej zaokrąglone panele i telefon, czyli zmiana wyglądu zatwierdzonego przez użytkownika.
  - Confidence: LOW — wygląd nie był oceniany.
  - Blind spot: Wygląd telefonu z `rounded-xl`.
- **Decision**: FIXED via Fix C — rama i szuflada telefonu na stałych tokenach `--radius-phone` / `--radius-phone-sheet`, reszta (tor, panele, kafelek, karta w telefonie) na `rounded-xl` według `--radius`, ukrywanie paska przewijania w `@utility no-scrollbar`; panele slajdów 2 i 3 mają teraz ok. 14 px zamiast 24 px zaokrąglenia

### F8 — Najmniejszy tekst w SVG przy skalowaniu jest bardzo mały

- **Severity**: 💡 OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Safety & Quality
- **Location**: src/components/home/FlowSlide.astro:50, src/components/home/LensSlide.astro (etykieta „WYDATKI WG KATEGORII")
- **Detail**: Etykiety `font-size="9"` w jednostkach viewBox po przeskalowaniu na wąskim panelu schodzą poniżej 9 px, co utrudnia czytanie.
- **Fix**: Podnieść do 10–11 jednostek albo zwiększyć kontrast tych etykiet.

- **Decision**: FIXED — etykieta „PRZYCHODY” 9 -> 11 jednostek, „WYDATKI WG KATEGORII” 9 -> 10 jednostek z letter-spacing 0.8 (przy 11 dotykała obrzeża lupy); sprawdzone na zrzutach 390 px

## Odrzucone w trakcie przeglądu

- „Usunięcie «Załóż konto» z Topbaru dotyczy innych widoków": sprawdzone, wariant niezalogowany jest renderowany tylko na `/` i na stronach `/dev/*`; `dashboard`, `history` i `settings/*` są pod `PROTECTED_ROUTES`.
- „`fill` nie jest w `UTILITIES`": jest (`scripts/check-ui-tokens.mjs`), brakuje tylko `stop`.
- Zduplikowane `id` w `LensSlide` (`lens-blur`, `lens-clip`, `lens-ring`): jeden egzemplarz na stronie, brak ryzyka dziś.
- Gotowość na jasny motyw (notch, scrim, ramka, poświata zakładają ciemny): zapisane w planie jako zaakceptowane ryzyko, komentarz w `PhoneSlide.astro:23`.
