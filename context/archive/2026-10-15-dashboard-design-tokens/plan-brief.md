# Dashboard design tokens — Plan Brief

> Full plan: `context/changes/dashboard-design-tokens/plan.md`
> Research: `context/changes/dashboard-design-tokens/research.md`

## What & Why

Dashboard jest zbudowany z klas palety (`purple-*`, `blue-100/*`, `slate-900`) zamiast z tokenów, a pola formularza i przyciski są odtwarzane z klas. Zmiana podpina widok pod tokeny i komponenty `ui/`, nie zmieniając jego wyglądu, i zostawia regułę oraz kontrolę przeciw dryfowi.

## Starting Point

`global.css` ma kompletne, ale martwe tokeny shadcn; `.dark` nigdzie nie jest nakładane, więc ciemny wygląd to `bg-cosmic` i klasy literalne. Skan hardcodów daje 54 trafienia w 7 plikach, a `ui/` ma tylko `button` i `drawer`.

## Desired End State

Dashboard wygląda tak samo, ale skan hardcodów zwraca 0, kontrolki mają widoczny fokus z tokenu `--ring`, a `<html class="dark">` włącza ciemne wartości. Jasne `:root` czeka na przyszły przełącznik, a skrypt `check:ui` pilnuje oczyszczonych plików.

## Key Decisions Made

| Decision | Choice | Why | Source |
| --- | --- | --- | --- |
| Gdzie ciemne wartości | `.dark` + `<html class="dark">` na stałe | Docelowo jasny motyw domyślny z przełącznikiem | Plan |
| Wygląd po zmianie | Ciemny na stałe, bez delty | Refaktor tokenowy łatwy do oceny na zrzutach | Plan |
| `--primary` | Obecny fiolet (`purple-600`) | Bez redesignu; ujednolici `Button` w innych widokach | Plan |
| Gradient tytułu | Tokeny `--title-from`/`--title-to` | Zachowuje wygląd bez klas palety | Plan |
| Komponenty | `shadcn add input select card label` | Ścieżka stosu, bez `shadcn init` | Research |
| Kontrola | Skrypt Node bez zależności | Nowa zależność lint wymaga osobnej decyzji | Research |
| Kitchen-sink | `src/pages/dev/...`, 404 w produkcji | Bramka wizualna bez nowego runnera | Plan |

## Scope

**In scope:** `dashboard.astro`, `Topbar`, `month/*`, `ServerError`, tokeny w `global.css`, `Layout.astro`, 4 komponenty `ui/`, reguła i skrypt kontroli.

**Out of scope:** history/settings/auth, `Banner.astro`, przełącznik motywu, redesign, `shadcn init`.

## Architecture / Approach

Kolejność z `/10x-ui`: komponenty → wartości tokenów → widok → stany → zabezpieczenie. Wartości żyją w `:root`/`.dark`, `@theme inline` je publikuje, widok czyta je przez role (`bg-primary`, `text-muted-foreground`, `text-success`).

## Phases at a Glance

| Phase | What it delivers | Key risk |
| --- | --- | --- |
| 1. Komponenty `ui/` | `input`, `select`, `card`, `label` | Radix `Select` w `Drawer` |
| 2. Wartości tokenów | Fiolet w `--primary`, nowe tokeny, `class="dark"` | Globalny `--primary` zmienia inne widoki |
| 3. Widok dashboard | 0 hardcodów, komponenty, fokus | Regresja `data-*`/`id` dla smoke testu |
| 4. Stany i bramka | Kitchen-sink + zrzuty | Stany hover/focus trudne do wymuszenia |
| 5. Zabezpieczenie | Reguła w `CLAUDE.md` + `check:ui` | Zakres `lint-staged` |

**Prerequisites:** brak; shadcn CLI i Playwright plugin dostępne.
**Estimated effort:** ~3-4 sesje w 5 fazach.

## Open Risks & Assumptions

- `--primary` jest globalny; zrzuty auth/settings/history w fazie 2.
- Jasne `:root` niesprawdzone wizualnie do czasu przełącznika.
- `ServerError` współdzielony z auth: zmiana na `destructive` dotknie też stron auth.

## Success Criteria (Summary)

- Dashboard bez zmiany wyglądu, skan hardcodów = 0 na 7 plikach.
- Wszystkie 7 stanów pokazane lub N/A z powodem; fokus widoczny na każdej kontrolce.
- Reguła i kontrola, które utrzymają kolejny widok przy tokenach.
