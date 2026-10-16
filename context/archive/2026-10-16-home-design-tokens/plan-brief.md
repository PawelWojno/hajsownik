# Strona główna na tokenach stylów — Plan Brief

> Full plan: `context/changes/home-design-tokens/plan.md`
> Research: `context/changes/home-design-tokens/research.md`

## What & Why

Strona główna `/` (`index.astro` + `Welcome.astro`) ma 20 linii z kolorami z palety Tailwinda i wartościami `[350px]`, więc nie podąża za motywem i nie jest objęta kontrolą `check:ui`. Przenosimy ją na tokeny z `global.css` i komponenty `ui/`, żeby przyszły redesign marketingowy zaczynał od czystej bazy, a kolejny agent nie kopiował literałów.

## Starting Point

Poprzednia zmiana (`dashboard-design-tokens`) oczyściła dashboard i odroczyła `Welcome.astro` jako osobną zmianę. Tokeny w większości już istnieją i mają te same wartości co dzisiejsze literały; brakuje ich tylko dla dekoracji tła, które usuwamy.

## Desired End State

`/` wygląda jak dziś pod względem układu i geometrii hero, ale bez orbów i gwiazd w tle, z kolorami z tokenów, CTA ze stylem przycisku aplikacji (z widocznym fokusem klawiatury) i trzema kartami z jednego źródła. `Welcome.astro` i `index.astro` są w `CLEAN_PATHS`.

## Key Decisions Made

| Decision | Choice | Why (1 sentence) | Source |
| --- | --- | --- | --- |
| Polityka wyglądu | Kolory z tokenów, geometria hero zostaje | Redesign i tak przepisze układ, a tokeny kolorów przetrwają go | Plan |
| Dekoracje tła | Usunąć orby i gwiazdy | Przyszły projekt strony ich nie ma; żadnych nowych tokenów | Plan |
| Karty funkcji | `ui/card` + tablica, tło `--card` (10%) | Jeden blok zamiast trzech i zero nowych tokenów | Plan |
| CTA | `buttonVariants` na `<a>` z `cn()` | Bez `asChild` w `.astro` i bez hydratacji; ring fokusu z komponentu | Research |
| Weryfikacja wizualna | Playwright przed/po, bez runnera | Ten sam wzorzec co `topbar-menu`, bez nowej zależności | Plan |
| Topbar | Poza zakresem | Duplikat linków odroczony (D1) | Research |

## Scope

**In scope:** `Welcome.astro` na tokenach, zrzuty przed/po, test fokusu i hover CTA, `CLEAN_PATHS`.

**Out of scope:** nowe tokeny, `global.css`, Topbar, pozostałe widoki z paletą, redesign, `toHaveScreenshot`.

## Architecture / Approach

Jedna zmiana w jednym widoku: usunięcie dekoracji, podmiana klas na tokeny, `buttonVariants` dla CTA (z nadpisaniem geometrii przez `cn()`), `ui/card` z tablicy. Zrzuty „przed" robimy najpierw, „po" na końcu.

## Phases at a Glance

| Phase | What it delivers | Key risk |
| --- | --- | --- |
| 1. Zrzuty bazowe „przed" | Zrzuty 390/1280 px i pomiar fokusu | Zależy od lokalnego dev serwera (`astro dev --background`) |
| 2. Widok na tokenach | `Welcome.astro` bez literałów palety | Drobne różnice wizualne (tekst 80%, gradient, karty 10%) |
| 3. Stany, bramka i zabezpieczenie | Zrzuty „po", fokus/hover, `CLEAN_PATHS` | `Card` (React) w `.astro` bez hydratacji, do potwierdzenia na zrzucie |

**Prerequisites:** lokalny Supabase i `npm run preview` dla smoke (faza 3); dev serwer na 4401.
**Estimated effort:** ~1 sesja, 3 fazy.

## Open Risks & Assumptions

- Zakładamy, że `Card` z `.astro` renderuje się poprawnie bez `client:*` (do zobaczenia na zrzucie w fazie 2).
- Wypełnienie wariantu `outline` (`dark:bg-input/30`) dojdzie do CTA „Załóż konto"; jeśli przeszkadza, dodajemy nadpisanie w fazie 3.
- Fokus CTA „przed" mierzymy dopiero w fazie 1; jeśli domyślny obrys był już widoczny, zarzut C4 ma mniejszą wagę.

## Success Criteria (Summary)

- `/` bez orbów i gwiazd, z kolorami z tokenów, widocznym fokusem na CTA i trzema kartami.
- Skan wartości = 0 trafień, `check:ui`, `lint`, `astro check`, `build` i `smoke` zielone, oba pliki w `CLEAN_PATHS`.
