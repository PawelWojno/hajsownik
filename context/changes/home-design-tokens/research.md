---
date: 2026-10-16T19:22:59+02:00
researcher: Claude (claude-sonnet-5-5)
git_commit: 70c105f5edc337b3ed62edfb73c4ad4ed9ef2616
branch: master
repository: hajsownik
topic: "Strona główna (index.astro + Welcome.astro) na tokenach stylów: audyt zarzutów"
tags: [research, codebase, welcome, index, design-tokens, ui]
status: complete
last_updated: 2026-10-16
last_updated_by: Claude (claude-sonnet-5-5)
---

# Research: Strona główna na tokenach stylów

**Date**: 2026-10-16T19:22:59+02:00
**Researcher**: Claude (claude-sonnet-5-5)
**Git Commit**: 70c105f5edc337b3ed62edfb73c4ad4ed9ef2616
**Branch**: master (zmiana jeszcze bez gałęzi; kod nietknięty)
**Repository**: hajsownik

## Research Question

Czy 5 wstępnych zarzutów wobec strony głównej (`/`, `src/pages/index.astro` + `src/components/Welcome.astro`) jest prawdziwych, jakie są dowody (plik:linia), jak wygląda mapowanie literałów na istniejące tokeny i co plan musi rozstrzygnąć? Zakres: jeden widok; `Topbar` poza zakresem (`change.md`).

Badanie prowadzone lokalnie (jeden widok, kilka plików), bez podagentów. Niczego nie uruchamiano w przeglądarce, więc zachowanie fokusu i wygląd po zmianie pozostają do sprawdzenia w fazie implementacji.

## Summary

- **Skan wartości zakodowanych na sztywno** (regex z `10x-ui`, identyczny z `scripts/check-ui-tokens.mjs:23-25`): `Welcome.astro` = **20 linii**, `index.astro` = **0** (skan na `70c105f`). Widok jest więc jednym plikiem do migracji; `index.astro` tylko renderuje `<Welcome />` w `<Layout>` (`index.astro:6-8`).
- **Wszystkie 5 zarzutów potwierdzone co do faktów**, z dwiema korektami: (a) tytuł ma 3 stopnie gradientu (`from-blue-200 via-purple-200 to-pink-200`), a tokeny `title-from`/`title-to` dają 2 stopnie, więc zamiana zmienia wygląd; (b) brak focus-visible na CTA jest brakiem *jawnego* stylu, a nie dowodzonym brakiem fokusu: przeglądarka może pokazać domyślny obrys (do sprawdzenia).
- **Większość literałów ma już token o tej samej wartości w trybie ciemnym** (tabela w C2), więc migracja to głównie podmiana klas. Brakuje tokenów tylko dla dekoracji tła (orby, gwiazdy) i dla tła karty funkcji (`bg-white/5` ≠ `--card` = `white/10`).
- **Najważniejsza decyzja dla planu:** czy zachować dokładny dotychczasowy wygląd (wtedy kilka nowych tokenów lub nadpisań), czy zaakceptować drobne różnice, które daje użycie istniejących tokenów i `ui/button` (rozmiar CTA, krycie tekstu, gradient tytułu). To decyzja wizualna użytkownika, nie fakt z kodu.

## Detailed Findings

### C1. Brakujące tokeny: dekoracje tła (Missing tokens)

- Trzy „orby" `Welcome.astro:7-9`: `bg-purple-500/20`, `bg-blue-500/15`, `bg-indigo-400/10`, rozmiary `h-[350px] w-[350px]`, `h-[250px] w-[250px]`, `h-[300px] w-[300px]` i `blur-[120px]`/`[100px]`/`[140px]`. Żaden z tych kolorów ani rozmiarów nie ma tokenu w `global.css:7-99` (sprawdzony zbiór: `:root`, `.dark`).
- Pole gwiazd `Welcome.astro:14`: inline `style` z trzema `radial-gradient(... rgba(255,255,255,0.15|0.1|0.07) ...)` i `background-size`/`background-position` w px. Regex `check:ui` łapie `rgba(` (`check-ui-tokens.mjs:24`), więc ta linia zablokowałaby `check:ui` po dopisaniu pliku do `CLEAN_PATHS`.
- Precedens rozwiązania: `@utility bg-cosmic` w `global.css:151-153` czyta tokeny `--cosmic-edge/--cosmic-mid`, a sam widok używa tylko klasy `bg-cosmic` (`Welcome.astro:5`). Gwiazdy i orby mogą pójść tą samą drogą (tokeny + `@utility`).
- Reguła `lessons.md` („Jasny motyw (:root) trzeba utrzymywać razem z ciemnym (.dark)"): każdy nowy token dostaje wartość w `:root` i `.dark` w tej samej zmianie.
- **Wpływ na użytkownika:** tło strony głównej nie podąża za żadnym tokenem motywu; przy zmianie palety strona startowa zostaje ze starymi kolorami.
- Uwaga dot. zarzutu 1: orb `purple-500/20` to inny odcień niż `--primary` (purple-600), więc „zmiana `--primary` nie dotrze do tła" jest prawdą, ale nawet po zmianie na `bg-primary/20` kolor tła by się przesunął.

### C2. Zduplikowane literały, które mają token (Missing tokens, mapowanie)

Tryb ciemny (aplikacja jest ciemna przez `<html class="dark">`, `Layout.astro:14`). Wartości z `global.css` `.dark` (linie podane):

| Literał w widoku (`Welcome.astro`) | Istniejący token (`.dark`) | Zgodność | Uwaga |
| --- | --- | --- | --- |
| `text-white` (`:62,85,107`; CTA `:31,37`) | `--foreground` `oklch(1 0 0)` (`:57`) | identyczna | |
| `border-white/10` (`:46,68,91`; `border` bazowo = `--border`) | `--border` `oklch(1 0 0 / 10%)` (`:72`) | identyczna | `global.css:157` już stosuje `border-border` do `*` |
| `border-white/20` (CTA outline `:37`) | `--input` `oklch(1 0 0 / 20%)` (`:73`) | identyczna | |
| `hover:bg-white/10` (CTA `:37`) | `--accent` `oklch(1 0 0 / 10%)` (`:69`) | identyczna | opis w `context/archive/2026-10-15-dashboard-design-tokens/tokens.md:24` |
| `text-blue-100/70` (`:25`), `/60` (`:63,86,108`) | `--muted-foreground` `oklch(0.932 0.032 255.585 / 80%)` (`:68`) | **kolor ten sam, krycie 80% zamiast 70%/60%** | zamiana rozjaśni tekst |
| `text-purple-300` (ikony `:57,79,102`) | `--link` `oklch(0.827 0.119 306.383)` (`:82`) | zgodna z paletą Tailwind purple-300 (wg wiedzy badającego, nie sprawdzano w źródle Tailwinda) | `link` to token tekstu akcentowego, nie ikony; semantyka do decyzji |
| `bg-purple-600` / `hover:bg-purple-500` (CTA `:31`) | `--primary` `oklch(0.558 0.288 302.321)` (`:62`) / `--primary-hover` `oklch(0.627 0.265 303.9)` (`:64`) | identyczna z palety | |
| `bg-white/5` (karty `:46,68,91`) | `--card` `oklch(1 0 0 / 10%)` (`:58`) | **inne**: 5% vs 10% | brak tokenu dla 5% |
| `from-blue-200 via-purple-200 to-pink-200` (tytuł `:22`) | `--title-from` (`:80`) / `--title-to` (`:81`), użyte w `MonthScreen.tsx:47` jako `from-title-from to-title-to` | początek zgodny z `blue-200` wg `tokens.md:22`; **środek i koniec inne** (`via-purple-200`, `to-pink-200`) | `tokens.md:23` mapuje `title-to` na `purple-200`, nie `pink-200` |

- **Wpływ na użytkownika:** dashboard i strona główna mają dziś dwa różne gradienty tytułu (dwa vs trzy stopnie); po zmianie palety motywu strona główna jedyna zostanie z literałami.

### C3. Brakujący współdzielony komponent (Missing shared component)

- CTA `Welcome.astro:29-40` to dwa ręczne `<a>`: `px-6 py-3 text-base font-medium rounded-lg` + kolory z C2.
- `ui/button.tsx:12` (`default`) = `bg-primary text-primary-foreground shadow-xs hover:bg-primary-hover`; `outline` (`:15-16`) w ciemnym motywie dodaje `dark:bg-input/30` i `dark:hover:bg-input/50`, czyli **wypełnienie, którego ręczny CTA nie ma**. Rozmiar `lg` (`:24`) = `h-10 px-6`, `text-sm`, `rounded-md`, czyli **mniejszy niż obecny** (`py-3 text-base rounded-lg`).
- `buttonVariants` jest eksportowane (`button.tsx:50`) i **nie ma użyć poza własnym plikiem** (grep `buttonVariants` w `src/**/*.astro|tsx`, 0 trafień poza `ui/button.tsx`). `asChild` użyte tylko dla `DrawerClose` (`MonthPicker.tsx:78`, `EntrySheet.tsx:81`), nigdy z `.astro`.
- Hipoteza do sprawdzenia w implementacji (nie zweryfikowana): `asChild` wywołane z `.astro` przekazuje dziecko jako statyczny HTML, nie element React, więc `Slot` może nie móc go sklonować. Bezpieczniejsza droga to `class={buttonVariants({ size: "lg" })}` na zwykłym `<a>`; nie wymaga hydratacji i pozwala zachować semantykę linku.
- Karty funkcji: trzy bloki `Welcome.astro:46-66`, `:68-89`, `:91-111` o identycznej strukturze (ikona SVG, `h3`, `p`); różnią się tylko ścieżką SVG i tekstami (3 różne ikony). `ui/card.tsx:8` (`bg-card ... rounded-xl border py-6 shadow-sm`, flex-col, `gap-6`) istnieje; precedens nadpisań: `MonthScreen.tsx:56` (`gap-0 rounded-2xl p-6 shadow-none backdrop-blur-xl`). Uwaga z `CLAUDE.md`: `rounded-2xl` nie jest objęte kontrolą `check:ui`; widok używa `rounded-xl`, co jest zgodne z `--radius`.
- **Wpływ na użytkownika:** wygląd przycisków na stronie wejściowej różni się od przycisków w aplikacji (rozmiar, wypełnienie outline), a każda zmiana wspólnego przycisku ominie stronę główną.

### C4. Stany interaktywne CTA (Missing states)

- CTA `:31` i `:37` mają `hover:` i `transition-colors`, ale **żadnej jawnej klasy `focus-visible:`**. `ui/button.tsx:8` ma `focus-visible:ring-ring/50 focus-visible:ring-[3px]`; `Topbar.astro:25-26` definiuje `focusClass` o tym samym wyglądzie.
- Korekta zarzutu: `global.css:157` ustawia `outline-ring/50` na `*` (kolor obrysu), więc domyślny obrys przeglądarki dla fokusu klawiaturą prawdopodobnie jest widoczny w kolorze `ring`. To **nie zostało sprawdzone w przeglądarce**; brak jawnego stylu jest faktem, brak widocznego fokusu nie jest dowiedziony.
- Macierz 7 stanów dla widoku: `default`, `hover`, `focus-visible` mają znaczenie (2 linki CTA). `disabled`, `error`, `empty`, `loading`: N/A (statyczna strona bez formularzy, danych ani stanu asynchronicznego; sprawdzony zbiór: `Welcome.astro`, `index.astro`).

### C5. Architektura: powielone linki logowania (Accidental architecture)

- `Welcome.astro:18` renderuje `<Topbar />`; wariant niezalogowany `Topbar.astro:162-179` pokazuje „Niezalogowano" oraz linki „Zaloguj się" (`/auth/signin`) i „Załóż konto" (`/auth/signup`). Hero `Welcome.astro:29-40` ma te same dwa linki. Na `/` użytkownik widzi więc dwa zestawy tych samych linków.
- `/` jest tylko dla niezalogowanych: `middleware.ts:6,26-27` przekierowuje zalogowanego na `/dashboard`. Z pięciu użyć `<Topbar />` w `src` (poza `src/pages/dev/`): `Welcome.astro:18`, `dashboard.astro:41`, `history.astro:52`, `settings/categories.astro:23`, `settings/recurring.astro:43` cztery ostatnie są pod `PROTECTED_ROUTES` (`middleware.ts:4`: `/dashboard`, `/history`, `/settings`), więc **na sprawdzonej ścieżce wariant niezalogowany Topbaru pojawia się tylko na `/`** (i na stronie dev).
- Zgodnie z `change.md` Topbar jest poza zakresem; to zarzut do **odroczenia** z powodem (zob. D1), chyba że plan zdecyduje inaczej.
- **Wpływ na użytkownika:** powtórzenie tych samych dwóch linków nad hero i w hero dezorientuje, ale nie blokuje przepływu.

## Code References

- `src/pages/index.astro:6-8` — `<Layout><Welcome /></Layout>`, 0 trafień skanu.
- `src/components/Welcome.astro:5` — `bg-cosmic` (już na tokenach).
- `src/components/Welcome.astro:7-9` — orby (literały palety, wartości arbitralne).
- `src/components/Welcome.astro:14` — pole gwiazd (inline `rgba`).
- `src/components/Welcome.astro:22,25,31,37,46,57,62,63,68,79,85,86,91,102,107,108` — pozostałe literały (razem z orbami i gwiazdami 20 linii skanu).
- `src/components/Welcome.astro:29-40,46-111` — CTA i trzy powielone karty.
- `src/styles/global.css:7-99,101-149,151-153,157` — tokeny, publikacja w `@theme inline`, `@utility bg-cosmic`, `outline-ring/50`.
- `src/components/ui/button.tsx:12,15-16,24,50` — `default`, `outline`, `lg`, `buttonVariants` (bez użyć poza plikiem).
- `src/components/ui/card.tsx:8` — `Card`.
- `src/components/month/MonthScreen.tsx:47,56` — gradient `from-title-from to-title-to`, `Card` z nadpisaniami.
- `scripts/check-ui-tokens.mjs:11-18,23-25` — `CLEAN_PATHS` i regex.
- `src/middleware.ts:4,6,26-27` — trasy chronione i „tylko dla niezalogowanych".
- `src/layouts/Layout.astro:14` — `<html class="dark">`.

## Architecture Insights

- Kontrakt UI repozytorium: tokeny w `global.css` (`:root`, `.dark`, `@theme inline`), komponenty w `src/components/ui/`, kontrola `check:ui` na liście `CLEAN_PATHS`. Wariant `10x-ui`: **istniejący system projektowy** (rozszerzamy, bez drugiego `shadcn init`).
- Dekoracje tła mają precedens w `@utility bg-cosmic` (tokeny w `global.css`, w widoku jedna klasa).
- `buttonVariants` to gotowy sposób na stylowanie linku jak przycisku bez React-owego `asChild` w `.astro` (do potwierdzenia w implementacji).
- `rounded-xl`/`rounded-lg` podążają za `--radius`; skala `rounded-2xl` nie jest objęta `check:ui` (`CLAUDE.md`).

## Historical Context (from prior changes)

- `context/archive/2026-10-15-dashboard-design-tokens/research.md:83` (D1) — `Welcome.astro` było wprost odroczone jako plik z paletą poza zakresem „jeden widok"; ten plik jest tym odroczeniem. Ta sama linia ostrzega, że zmiana globalnych tokenów zmienia wygląd `Button default` w innych widokach (do sprawdzenia wizualnie).
- `context/archive/2026-10-15-dashboard-design-tokens/research.md` (D3) — gradient tytułu rozstrzygnięto tam jako dwa tokeny (`title-from`/`title-to`); użyte w `MonthScreen.tsx:47`. Strona główna powinna dostać tę samą decyzję albo świadomy wyjątek.
- `context/archive/2026-10-15-dashboard-design-tokens/tokens.md:22-27` — tabela „co zastąpiło co" dla tokenów, którą ta zmiana rozszerza (nowy plik `tokens.md` w tym folderze zmiany, jeśli powstaną nowe tokeny).
- `context/foundation/lessons.md` — reguła o utrzymywaniu `:root` razem z `.dark`.

## Related Research

- `context/archive/2026-10-15-dashboard-design-tokens/research.md` — pierwszy audyt tokenów (widok dashboard); ten dokument podąża tą samą strukturą zarzutów.

## Open Questions

1. **Wygląd: zachować czy ujednolicić?** Użycie `ui/button` zmieni rozmiar CTA (`lg` = `h-10 text-sm rounded-md` vs `py-3 text-base rounded-lg`) i doda wypełnienie `dark:bg-input/30` w `outline`; `muted-foreground` rozjaśni tekst (80% vs 70/60%); gradient tytułu straci jeden stopień. Do decyzji w planie: zaakceptować różnice czy nadpisać klasami/dodać tokeny. To wybór użytkownika.
2. **Tokeny dla dekoracji:** nowe tokeny (np. kolory orbów i gwiazd) w `:root` i `.dark` plus `@utility`, czy zredukowanie tła do istniejących `cosmic-*`? Plan musi też usunąć wartości arbitralne (`h-[350px]`, `blur-[120px]`) lub przenieść je do `@utility`.
3. **Karta funkcji:** token dla `bg-white/5` (nowy) czy zmiana na `--card` (10%, wyraźniejsza karta)?
4. **Ikony `text-purple-300`:** użyć `text-link` (wartość ta sama, ale semantyka „link") czy dodać token ikon/akcentu?
5. **`asChild` z `.astro`:** potwierdzić w implementacji, że `buttonVariants` na `<a>` wystarcza (hipoteza z C3).
6. **Fokus:** zrobić zrzut/skrypt z fokusem klawiatury na CTA, żeby potwierdzić lub obalić brak widocznego obrysu (C4).
7. **Baseline wizualny:** repo nie ma runnera zrzutów (`toHaveScreenshot`); przed zmianą zrobić zrzuty `/` na 390 px i desktopie (Playwright), żeby fazę wizualną dało się porównać. Strona `/dev/dashboard-states` dotyczy dashboardu; dla statycznej strony głównej macierz stanów jest w większości N/A (C4), więc osobna strona kitchen-sink nie jest konieczna, ale plan powinien to uzasadnić.

## Deferred charges

- **D1. Topbar na `/` powiela linki hero (C5).** Powód: `Topbar` poza zakresem (`change.md`); wariant niezalogowany jest używany w praktyce tylko na `/` (C5). Decyzja: osobna zmiana lub świadome zostawienie.
- **D2. Pozostałe widoki z paletą** (`pages/auth/*`, `components/auth/*`, `history/*`, `settings/*`, `ui/LibBadge.astro`, `Banner.astro`): poza zakresem „jeden widok"; auth zaplanowano jako osobne zmiany.
