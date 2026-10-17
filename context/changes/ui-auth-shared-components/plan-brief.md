# Wspólne komponenty auth na tokenach — Plan Brief

> Full plan: `context/changes/ui-auth-shared-components/plan.md`
> Research: `context/changes/ui-auth-shared-components/research.md`

## What & Why

Trzy wspólne komponenty formularzy auth (`FormField`, `SubmitButton`, `PasswordToggle`) mają klasy palety i duplikują komponenty `ui/*`. Podpinamy je pod istniejące tokeny, żeby wygląd auth podążał za `global.css`, fokus klawiatury był widoczny, a błąd pola był powiązany z inputem.

## Starting Point

Skan hardcode: 8 trafionych linii w trzech plikach. Komponenty używają 4 formularze, które zostają bez zmian. Tokeny i `ui/input`, `ui/label`, `ui/button` już istnieją; `ServerError.tsx` jest wzorcem.

## Desired End State

Trzy pliki są czyste pod skanem `check:ui` (są w `CLEAN_PATHS`), strony `/auth/*` wyglądają podobnie jak dziś, a `/dev/dashboard-states` pokazuje stany tych kontrolek.

## Key Decisions Made

| Decision | Choice | Why (1 sentence) | Source |
| --- | --- | --- | --- |
| Tokeny | Bez nowych | Wszystkie potrzebne role już są w `:root` i `.dark` | Research |
| Pole formularza | `ui/input` + `ui/label`, `dark:bg-card` | Ten sam wzorzec co istniejące demo | Research / Plan |
| Propsy do demo | Opcjonalne `className` (SubmitButton), `disabled`, `inputClassName` (FormField) | Prawdziwe komponenty w stanach, formularze bez zmian | Plan review |
| Loading w demo | Opcjonalny `pending?` w `SubmitButton` | Pokazuje prawdziwy spinner bez zmiany formularzy | Plan |
| Miejsce demo | Sekcje w `/dev/dashboard-states` | Reguła CLAUDE.md: rozszerzać, nie budować drugiej strony | Plan |
| ARIA | `aria-invalid` + `aria-describedby` tylko na błąd | Minimalnie, bez ruszania `hint` od formularza | Plan |
| Kopie w settings | Odroczone | Osobny widok i osobna zmiana | Research |

## Scope

**In scope:** trzy komponenty auth, sekcje demo, `CLEAN_PATHS`.

**Out of scope:** `*Form.tsx`, strony auth, `global.css`, `settings/Recurring*Manager.tsx`, aria dla `hint`.

## Architecture / Approach

Zmiana wyglądu przy interfejsie propsów rozszerzonym tylko o opcjonalne `disabled`, `inputClassName`, `className`, `pending`: komponenty składają `ui/input`, `ui/label`, `ui/button` z klasami tokenowymi. Potem dowody w stronie dev, na końcu bramka skanu.

## Phases at a Glance

| Phase | What it delivers | Key risk |
| --- | --- | --- |
| 1. Komponenty | Trzy pliki na tokenach i `ui/*`, aria, `pending` | Różnica wizualna pola (tło, wysokość `h-9`) |
| 2. Demo | 7 stanów na stronie dev, zrzuty desktop i 390 px | Wymuszone stany ≠ prawdziwy hover i fokus |
| 3. Zabezpieczenie | `CLEAN_PATHS` + lint, check, build, smoke | Smoke wymaga działającego serwera |

**Prerequisites:** dev server i Playwright do zrzutów.
**Estimated effort:** ~1-2 sesje, 3 fazy.

## Open Risks & Assumptions

- `dark:bg-card` może wyglądać inaczej niż dawne `bg-white/10`; ocena na zrzucie.
- `ui/button` ma `h-9`; przycisk submit może być niższy niż dziś. `ui/input` ma `h-9` i tekst 14 px na desktopie (dziś wyższe pole, 16 px); `Label` dostaje `font-normal`.

## Success Criteria (Summary)

- `npm run check:ui`, lint, `astro check`, build i smoke przechodzą.
- Fokus klawiatury widoczny na polu i ikonie oka, błąd pola czytany przez czytnik.
- Zrzuty desktop i 390 px pokazują stany lub N/A z powodem.
