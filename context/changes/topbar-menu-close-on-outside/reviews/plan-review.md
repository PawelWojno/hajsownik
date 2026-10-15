<!-- PLAN-REVIEW-REPORT -->
# Plan Review: Topbar menu: zamykanie po kliknięciu obok i po Esc

- **Plan**: context/changes/topbar-menu-close-on-outside/plan.md
- **Mode**: Deep (weryfikacja kodu bez sub-agenta)
- **Date**: 2026-10-15
- **Verdict**: SOUND
- **Findings**: 0 critical, 1 warning, 3 observations

## Verdicts

| Dimension | Verdict |
|-----------|---------|
| End-State Alignment | PASS |
| Lean Execution | PASS |
| Architectural Fitness | PASS |
| Blind Spots | WARNING |
| Plan Completeness | WARNING |

## Grounding

5/5 paths ✓, `<details>` w `Topbar.astro:37,76,144` ✓, `history.astro:138` ✓, brak `ClientRouter` ✓, `check:ui` nie zareaguje na skrypt ✓, brief↔plan ✓, Progress↔Fazy ✓. Niezweryfikowane: numery linii w `smoke.mjs`.

## Findings

### F1 — `click` na `document` może nie zadziałać na iPhonie

- **Severity**: ⚠️ WARNING
- **Impact**: 🔎 MEDIUM — real tradeoff; pause to reason through it
- **Dimension**: Blind Spots
- **Location**: Phase 1 — Skrypt zamykający, `document` `click`; Phase 2 — Test zachowania
- **Detail**: Główny scenariusz to telefon (hamburger). Na iOS Safari zdarzenie `click` bywa niewysyłane do nasłuchiwacza na `document`, gdy dotknięty element nie jest „klikalny” (zwykły `div`, tło strony). Plan opiera zamykanie „po kliknięciu poza” wyłącznie na `click`, a faza 2 sprawdza telefon tylko w emulacji Chromium (Playwright, 390 px), która tego nie odtworzy. Brak pewności co do dzisiejszych wersji iOS.
- **Fix A ⭐ Recommended**: `pointerdown` zamiast `click` dla zamykania „poza”
  - Strength: `pointerdown` jest wysyłany na każdym elemencie; warunek „menu nie zawiera target” bez zmian.
  - Tradeoff: Menu zamknie się też przy dotknięciu tła, od którego zaczyna się przewijanie.
  - Confidence: MED — wzorzec powszechny, niesprawdzony na iOS.
  - Blind spot: Współgranie z natywnym przełączaniem `<summary>` przy dotyku (do sprawdzenia w fazie 2).
- **Fix B**: Zostać przy `click`, dopisać ręczny test na prawdziwym iPhonie/Safari do fazy 2
  - Strength: Zero zmian w kontrakcie skryptu.
  - Tradeoff: Jeśli test się nie powiedzie, i tak wracamy do Fix A; wymaga iPhone'a.
  - Confidence: MED — zależy od dostępu do urządzenia.
  - Blind spot: Nieznane, czy Safari na macOS ma tę samą wadę.
- **Decision**: FIXED (Fix A)

### F2 — Faza 2 dubluje ręczny punkt 1.4, a punkt 2.1 nie ma polecenia

- **Severity**: 🔍 OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Plan Completeness
- **Location**: Progress 1.4, 2.1–2.3
- **Detail**: Ręczna bramka 1.4 sprawdza tylko klik, a Esc i Tab dopiero 2.2/2.3, więc weryfikacja w przeglądarce jest zaplanowana dwa razy. Punkt 2.1 („wynik w rozmowie”) nie jest uruchamialnym poleceniem ani zapisanym skryptem.
- **Fix**: Zostaw jedną bramkę ręczną: rozszerz 1.4 o Esc i Tab albo scal fazę 2 z fazą 1. W 2.1 wskaż, gdzie zapisujemy skrypt Playwright lub zrzut jako dowód.
- **Decision**: FIXED (1.4 opisane jako szybka bramka klika, 2.1 wskazuje `screenshots/`)

### F3 — Brak warunków wstępnych dla `npm run smoke` i kolejności dev/build

- **Severity**: 🔍 OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Plan Completeness
- **Location**: Phase 1 — Success Criteria 1.1, 1.3
- **Detail**: `smoke.mjs` działa na żywym serwerze z lokalnym Supabase, a plan wspomina Supabase tylko w fazie 2; brak zapisu, jak uruchomić smoke (`build` → `preview` → `smoke`). `npm run build` psuje działający dev serwer, a ręczne 1.4 i faza 2 z niego korzystają.
- **Fix**: Dopisz w fazie 1 kolejność: `npx supabase start` → `build` → `preview` + `smoke`, a po buildzie zrestartuj dev serwer i odśwież twardo (Ctrl+F5) przed testem ręcznym.
- **Decision**: FIXED (akapit „Kolejność uruchamiania” w Success Criteria fazy 1)

### F4 — Pozostałość po trybie planowania i dwa niejasne zdania w fazie 2

- **Severity**: 🔍 OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Plan Completeness
- **Location**: `plan.md` linia 3; Phase 2 — Contract
- **Detail**: Linia 3 („Po zatwierdzeniu: zapisać jako… plan mode zabrania zapisu”) jest nieaktualna po zapisaniu pliku. Zdanie „kliknięcie w jego pozycję nagłówka/środek” jest niejednoznaczne, a „zrzuty z `master` w worktree” to przesada, bo klasy się nie zmieniają.
- **Fix**: Usuń linię 3, rozbij scenariusz zagnieżdżonego menu na dwa punkty (klik w `<summary>`, klik w listę), zastąp porównanie z `master` jednym zrzutem „po” na 390 px i 1280 px.
- **Decision**: FIXED (usunięta linia 3, doprecyzowany kontrakt fazy 2, kryterium 2.4 bez porównania z `master`)
