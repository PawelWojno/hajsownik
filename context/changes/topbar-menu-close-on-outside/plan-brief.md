# Topbar menu: zamykanie po kliknięciu obok i po Esc — Plan Brief

> Full plan: `context/changes/topbar-menu-close-on-outside/plan.md`

## What & Why

Menu hamburger (telefon) i „Ustawienia” (desktop) w `Topbar.astro` zamykają się dziś tylko kliknięciem we własny nagłówek, bo tak działa natywny `<details>`. Zmiana sprawia, że zamykają się też po kliknięciu obok, po Esc i po wyjściu fokusu. Pomysł pochodzi z follow-upu zmiany `dashboard-design-tokens`.

## Starting Point

`Topbar.astro` ma trzy natywne `<details>` (hamburger, zagnieżdżone „Ustawienia” w hamburgerze, desktopowe „Ustawienia”) i nie ma żadnego skryptu. W repo jest precedens małego `<script>` w komponencie Astro (`history.astro:138`), a nawigacja to pełne przeładowania stron.

## Desired End State

Otwarte menu zamyka się po kliknięciu poza nim, po Esc (fokus wraca na nagłówek menu) i po Tab poza menu; kliknięcie w środku (też w zagnieżdżone „Ustawienia”) go nie zamyka. Wygląd bez zmian, bez JS menu działa jak dotąd.

## Key Decisions Made

| Decision                  | Choice                                            | Why (1 sentence)                                                             | Source |
| ------------------------- | ------------------------------------------------- | ---------------------------------------------------------------------------- | ------ |
| Sposób implementacji      | Mały skrypt w `Topbar.astro`, natywne `<details>` | Wygląd zostaje identyczny, zmiana jest w jednym pliku i bez hydratacji React | Plan   |
| DropdownMenu (shadcn)     | Odrzucony                                         | Zmieniłby wygląd menu na telefonie i zwiększył zakres                        | Plan   |
| Zakres klawiatury         | Klik poza, Esc, wyjście fokusu                    | Spójne zachowanie dla myszy i klawiatury                                     | Plan   |
| Zagnieżdżone „Ustawienia” | Bez atrybutu; zamyka się z rodzicem               | Kliknięcie w jego środku nie może zamykać menu                               | Plan   |

## Scope

**In scope:** `data-topbar-menu` na dwóch `<details>` i skrypt w `Topbar.astro`; weryfikacja w przeglądarce.

**Out of scope:** DropdownMenu, nawigacja strzałkami, zmiany wyglądu i tokenów, wariant niezalogowany.

## Architecture / Approach

Natywne `<details>` zostają. Jeden `<script>` na końcu `Topbar.astro` dodaje nasłuchiwacze `pointerdown` i `keydown` na dokumencie oraz `focusout` na menu, ograniczone do `details[data-topbar-menu]`.

## Phases at a Glance

| Phase                         | What it delivers                                       | Key risk                                                                           |
| ----------------------------- | ------------------------------------------------------ | ---------------------------------------------------------------------------------- |
| 1. Skrypt zamykający menu     | Atrybuty i skrypt w `Topbar.astro`                     | Zamknięcie menu przy kliknięciu we własny nagłówek lub w zagnieżdżone „Ustawienia” |
| 2. Weryfikacja w przeglądarce | Test Playwright (390 px i desktop), porównanie wyglądu | Zależy od lokalnego Supabase i konta testowego                                     |

**Prerequisites:** lokalny Supabase (`npx supabase start`), konto testowe.
**Estimated effort:** ~1 sesja, 2 fazy.

## Open Risks & Assumptions

- `focusout` z pustym `relatedTarget` (klik w tło, alt-tab) celowo nie zamyka menu; klik/dotknięcie poza obsługuje osobny nasłuchiwacz `pointerdown` (nie `click`, bo na iOS Safari `click` z tła strony nie zawsze dociera do `document`).
- Zachowanie Tab poza menu może różnić się między przeglądarkami (do sprawdzenia w fazie 2).

## Success Criteria (Summary)

- Menu zamyka się po kliknięciu obok, po Esc i po wyjściu fokusu, na telefonie i desktopie.
- Wygląd menu bez zmian, `lint`, `check:ui`, `build` i `smoke` zielone.
