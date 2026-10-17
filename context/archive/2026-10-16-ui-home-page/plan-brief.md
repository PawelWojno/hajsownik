# Projekt strony startowej — Plan Brief

> Full plan: `context/changes/ui-home-page/plan.md`
> Research: `context/changes/ui-home-page/research.md`

## What & Why

Strona `/` dostaje nowy układ ze szkicu `hero-karuzela.html`: nazwa aplikacji, krótki opis, jeden duży przycisk „Załóż konto" i karuzela pokazująca, jak działa aplikacja. Szkic jest propozycją, więc kilka rzeczy zmieniamy (Topbar, karty, węższe slajdy, kafelki z minusem). Zasada: wszystko na tokenach, bez hexów w widoku.

## Starting Point

Dziś `/` to wyśrodkowane hero z dwoma przyciskami i trzema kartami funkcji (`Welcome.astro`), już na tokenach po `home-design-tokens`. Topbar niezalogowany pokazuje „Zaloguj się" i „Załóż konto".

## Desired End State

Anonim widzi gradientowe „Hajsownik", opis (kilka sekund, od razu, ile zostaje), linię „Jeden dom, wspólne dane" z wstawką o prywatności, duży „Załóż konto" z linkiem „Zaloguj się" obok i karuzelę 3 slajdów. Od 1024 px dwie kolumny, niżej jedna.

## Key Decisions Made

| Decision | Choice | Why | Source |
| --- | --- | --- | --- |
| Kolory kategorii | Nowe tokeny `category-*` (6) | Wygląd jak w szkicu, zgodnie z kontraktem | Plan |
| Karuzela | Astro + `<script>` | Zero hydratacji, wzorzec z `Topbar` | Plan |
| Topbar | Zostaje, bez „Załóż konto" | CTA w hero jest jedynym wejściem do rejestracji | Plan |
| Karty funkcji | Usunięte, treść w opisie + „Jeden dom, wspólne dane" + prywatność | Powielały opis | Plan |
| Nazwa aplikacji | Gradientowy `h1` „Hajsownik" | Szkic jej nie eksponował | Plan |
| Slajdy 2 i 3 | Węższe, kwoty pod nazwą, kafelki z „−" | Mieszczą się między strzałkami, bez nachodzenia | Plan |
| Etykieta miesiąca | Na serwerze przez `formatMonthLabel(currentMonthStart())` | Ta sama logika co w aplikacji, bez migotania | Plan |
| Link „Zaloguj się" w hero | Dodany obok dużego „Załóż konto" | Pod ręką po przewinięciu, gdy Topbar jest poza ekranem | Plan |
| Literały ze szkicu (ramka, notch, scrim, szkło) | Mapowanie na istniejące tokeny + `@utility` na poświatę | Jasny motyw nadejdzie wkrótce i zmieni te tokeny w jednym miejscu | Plan review |
| Podpięcie karuzeli | Już w fazie 2 (tymczasowo w `Welcome.astro`) wraz z `CLEAN_PATHS` | Pauza po fazie 2 ma adres do oceny, `check:ui` czyta nowe pliki | Plan review |
| Przeciąganie myszką | Odrzucone | Dotyk działa natywnie, na komputerze są strzałki, paski i klawisze | Plan |
| Breakpoint | `lg` (1024 px) | Standard Tailwinda, bez wartości arbitralnych | Plan |

## Scope

**In scope:** `Welcome.astro`, nowa karuzela w `src/components/home/`, tokeny `category-*`, Topbar (wariant niezalogowany), `CLEAN_PATHS`, `tokens.md`.

**Out of scope:** middleware, trasy, API, baza, inne widoki, wariant zalogowany Topbaru, jasny motyw, autoodtwarzanie, przeciąganie myszką.

## Architecture / Approach

Karuzela to scroll-snap w Astro; SVG slajdów 2 i 3 generowane z jednego obiektu danych przykładowych, kolory przez klasy tokenów. Mały skrypt obsługuje strzałki, paski i klawisze.

## Phases at a Glance

| Phase | What it delivers | Key risk |
| --- | --- | --- |
| 1. Tokeny i Topbar | `category-*`, Topbar bez „Załóż konto" | Przeliczenie hexów na `oklch` i wartości `:root` |
| 2. Karuzela | 3 slajdy, sterowanie, a11y | Układ SVG bez nachodzenia etykiet |
| 3. Strona `/` | Nowy układ, kopia, `CLEAN_PATHS` | Kopia wymaga akceptacji użytkownika |
| 4. Weryfikacja | Smoke, zrzuty 390 px i desktop | Fokus i dotyk wymagają ręcznego sprawdzenia |

**Prerequisites:** brak.
**Estimated effort:** ~2-3 sesje w 4 fazach.

## Open Risks & Assumptions

- Kopia (opis, wstawka o prywatności) to propozycja; finalizacja w review.
- Jasny wygląd powstanie osobno: wartości `:root` tokenów `category-*` są dobrane na serio, ale nieoglądane; ramka, notch i scrim telefonu zakładają ciemny motyw i trzeba je będzie wtedy przejrzeć.
- Po `build` dev server wymaga restartu i twardego odświeżenia.

## Success Criteria (Summary)

- `/` wygląda zgodnie z ustaleniami na 390 px i desktopie.
- `check:ui`, lint, `astro check`, build i `smoke` przechodzą.
- Wszystkie interaktywne elementy mają widoczny fokus.

## References

- Related research: `context/changes/ui-home-page/research.md`
- Szkic: `context/changes/ui-home-page/reference/hero-karuzela.html`
