<!-- PLAN-REVIEW-REPORT -->
# Plan Review: Projekt strony startowej

- **Plan**: context/changes/ui-home-page/plan.md
- **Mode**: Deep
- **Date**: 2026-10-17
- **Verdict**: REVISE
- **Findings**: 0 critical  3 warnings  0 observations

## Verdicts

| Dimension | Verdict |
|-----------|---------|
| End-State Alignment | PASS |
| Lean Execution | PASS |
| Architectural Fitness | PASS |
| Blind Spots | WARNING |
| Plan Completeness | WARNING |

## Grounding

Grounding: 6/6 paths ✓, 4/4 symbols ✓, brief↔plan ✓

## Findings

### F1 — Faza 2 nie ma czego sprawdzić

- **Severity**: ⚠️ WARNING
- **Impact**: 🔎 MEDIUM — real tradeoff; pause to reason through it
- **Dimension**: Plan Completeness
- **Location**: Phase 2 — kryteria sukcesu; Phase 3 — CLEAN_PATHS i Welcome
- **Detail**: Bramka `npm run check:ui` w fazie 2 ma objąć nowe pliki „po dopisaniu src/components/home do CLEAN_PATHS, patrz faza 3”. Dziś lista kończy się na src/components/month (scripts/check-ui-tokens.mjs:11-20), więc komenda w fazie 2 jest zielona i w ogóle nie czyta karuzeli. Notatka fazy każe zatrzymać się na ręcznym potwierdzeniu, zanim zacznie się faza 3. Punkty 2.3–2.6 (390 px, desktop, nachodzenie, minus, klawiatura) potrzebują adresu. HeroCarousel wchodzi na stronę dopiero w fazie 3, w Welcome.astro. Żadna trasa w src/ go dziś nie renderuje, a osobna strona /dev jest poza zakresem.
- **Fix A ⭐ Recommended**: W fazie 2 dopisać CLEAN_PATHS i wstawić HeroCarousel do Welcome
  - Strength: Pauza po fazie 2 ma realny adres; check:ui skanuje pliki, które właśnie powstały. expand() bierze tylko bezpośrednie dzieci katalogu (check-ui-tokens.mjs:29-34), więc pliki .astro mają leżeć w src/components/home/, nie w podkatalogu.
  - Tradeoff: Welcome.astro rusza się w dwóch fazach.
  - Confidence: HIGH — check:ui czyta wyłącznie CLEAN_PATHS; innego mountu karuzeli w src/ nie ma.
  - Blind spot: None significant.
- **Fix B**: Z fazy 2 wykreślić 2.1 i 2.3–2.6; zostawić lint i astro check
  - Strength: Faza 2 zostaje samym komponentem, bez tymczasowego wpięcia.
  - Tradeoff: Pauza po fazie 2 nic nie pokazuje; nachodzenie etykiet widać dopiero w fazie 3.
  - Confidence: HIGH — te same sprawdzenia są już rozpisane w fazach 3 i 4.
  - Blind spot: None significant.
- **Decision**: APPLIED

### F2 — Ramka telefonu, notch i poświata bez tokenu

- **Severity**: ⚠️ WARNING
- **Impact**: 🔎 MEDIUM — real tradeoff; pause to reason through it
- **Dimension**: Blind Spots
- **Location**: Phase 1 — tokeny; Phase 2 — kontrakt kolorów
- **Detail**: Faza 1 dodaje sześć tokenów category-* i spina pasek przychodów oraz „Zostaje” z istniejącym --success. To drugie jest już decyzją planu (#2dd4bf w szkicu nie jest równe --success z .dark, oklch(0.845 0.143 164.978), global.css:75). Poza tą szóstką szkic ma literały oklch, których nie ma w .dark: ramka telefonu oklch(0.27 0.03 270) (hero-karuzela.html:99; najbliższe --secondary / --muted to oklch(0.269 0 0)), notch i scrim oklch(0.12 0.02 270) (:104, :115), tło strzałki = --background / 70% (:66), listbg = biały / 8% (:56), pasek toru = biały / 14% (:59), poświata = --primary / 36% (:53). Szkło lupy jest równe --popover (global.css:60). check:ui wywala oklch( w pliku z CLEAN_PATHS (check-ui-tokens.mjs:25-27). global.css skaner omija, więc nowy kolor może żyć tylko jako token albo @utility. Kontrakt fazy 2 wymienia fill-category-*, fill-success, fill-card, stroke-border, fill-foreground, fill-muted-foreground i var(--…). Nie mówi, co zastępuje ramkę, notch i scrim. Poświata jest „opcjonalna”.
- **Fix A ⭐ Recommended**: Dopisać w kontrakcie fazy 2 mapowanie na istniejące tokeny
  - Strength: Zostaje przy decyzji „sześć nowych kolorów”. Poświata staje się wymaganym @utility czytającym --primary; szkło → fill-popover; strzałka → bg-background/70; listbg → fill-foreground/8; tor → fill-foreground/15; ramka → border-secondary; notch i scrim → bg-background z przezroczystością.
  - Tradeoff: Ramka traci chromatyczność szkicu (0.03 przy hue 270). Przybliżenia nie były oglądane.
  - Confidence: MEDIUM — równość --popover i --success sprawdzona w plikach; wygląd przybliżeń nie.
  - Blind spot: Klasy z przezroczystością (/8, /70) nie były składane buildem w tym repo.
- **Fix B**: W fazie 1 dodać tokeny phone-bezel, phone-notch i scrim
  - Strength: Ilustracja może trzymać odcienie ze szkicu, a check:ui dalej przechodzi, bo oklch siedzi w global.css.
  - Tradeoff: Trzy kolejne pary :root/.dark dla statycznej ilustracji, której jasnych wartości nikt nie ogląda (lessons.md).
  - Confidence: MEDIUM — reguła :root+.dark jest jasna; koszt wizualny rezygnacji z nich nie był mierzony.
  - Blind spot: Wartości :root dla tych trzech tokenów i tak zostaną nieoglądane, tak jak reszta jasnego motywu.
- **Decision**: APPLIED

### F3 — Kryterium 1.4 obiecuje niezmieniony /dev/dashboard-states

- **Severity**: ⚠️ WARNING
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Plan Completeness
- **Location**: Phase 1 — Manual Verification, punkt 1.4
- **Detail**: Punkt 1.4 mówi, że /dev/dashboard-states wygląda bez zmian, bo doszły tylko tokeny. Ta strona renderuje <Topbar /> i w opisie stanu „default” pisze, że bez sesji widać wariant niezalogowany (src/pages/dev/dashboard-states.astro:78-82). /dev nie jest na PROTECTED_ROUTES (src/middleware.ts:4). Usunięcie drugiego linku (Topbar.astro:172-178) zmienia ten pasek. Dashboard, historia i ustawienia zostają przy wariancie zalogowanym.
- **Fix**: Przepisać 1.4 (i tytuł w Progress) na: ekran miesiąca i istniejące tokeny bez zmian; pasek niezalogowany traci „Załóż konto”, tak samo jak na /.
- **Decision**: APPLIED
