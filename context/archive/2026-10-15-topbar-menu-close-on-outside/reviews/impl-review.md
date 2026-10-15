<!-- IMPL-REVIEW-REPORT -->
# Implementation Review: Topbar menu: zamykanie po kliknięciu obok i po Esc

- **Plan**: context/changes/topbar-menu-close-on-outside/plan.md
- **Scope**: Full plan (phases 1–2 of 2)
- **Reviewed phases**: 1, 2
- **Date**: 2026-10-16
- **Verdict**: REJECTED (jedno krytyczne ustalenie z poprawką w jednej linii)
- **Findings**: 1 critical, 0 warnings, 0 observations

## Verdicts

| Dimension | Verdict |
|-----------|---------|
| Plan Adherence | PASS |
| Scope Discipline | PASS |
| Safety & Quality | PASS |
| Architecture | PASS |
| Pattern Consistency | PASS |
| Success Criteria | FAIL |

## Evidence

- Kod: `git diff dd14546..HEAD -- src/` to tylko `src/components/Topbar.astro`: `data-topbar-menu` na `<details class="sm:hidden">` i `<details class="relative flex-1">` plus blok `<script>` z `pointerdown`, `keydown` (Esc) i `focusout`. Zgodne z kontraktem planu po poprawkach z plan-review (w tym `pointerdown` zamiast `click`). Zagnieżdżone „Ustawienia” bez atrybutu, wariant niezalogowany bez zmian.
- Lista plików: poza kodem tylko pliki zmiany w `context/changes/topbar-menu-close-on-outside/` (w tym skrypt Playwright i 3 zrzuty, wymagane przez 2.1). Brak zmian nieplanowanych.
- Bramki na HEAD `a8883cf`: `astro check` 0/0/0 ✅, `build` ✅, `check:ui` ✅ (10 plików), `smoke` ✅; `lint` ❌ (F1). Punkt 2.1 (Playwright 17/17) nie uruchamiany ponownie w przeglądzie.
- Punkty ręczne 1.4, 2.2–2.4: odhaczone po potwierdzeniu użytkownika; dowody: wynik Playwright i zrzuty w `screenshots/`.
- Poza zakresem automatów: zachowanie `pointerdown` na prawdziwym iOS Safari nie było sprawdzone (świadoma decyzja z plan-review F1).

## Findings

### F1 — `npm run lint` pada na skrypcie Playwright dodanym w fazie 2

- **Severity**: ❌ CRITICAL
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Success Criteria
- **Location**: context/changes/topbar-menu-close-on-outside/screenshots/topbar-menu.check.js (eslint.config.js:82)
- **Detail**: Commit `fafdaf8` dodał do repo plik `.js`, który nie jest modułem, tylko wyrażeniem funkcji ładowanym przez narzędzie Playwright MCP. `eslint .` (reguły `strictTypeChecked`) zgłasza w nim 128 błędów (`no-unsafe-*`, `no-unused-expressions`). Kryterium 1.1 z planu (`npm run lint`) było zielone po fazie 1, a po fazie 2 jest czerwone, więc job `ci` na PR by nie przeszedł. Do commitu to przeszło, bo `lint-staged` lintuje tylko `*.{ts,tsx,astro}`, a faza 2 nie miała bramki „lint całego repo”. Kod aplikacji (`Topbar.astro`) jest czysty.
- **Fix**: W `eslint.config.js:82` dopisz do `ignores` wzorzec `context/**/screenshots/**` (obok `.agents/**` i `.claude/skills/**`), żeby kolejne skrypty dowodowe w folderach zmian nie łamały lintu; potem `npm run lint` i commit.
- **Decision**: FIXED (Fix now: `context/**/screenshots/**` dopisane do `ignores` w `eslint.config.js`; `npm run lint` zielony)
