<!-- PLAN-REVIEW-REPORT -->
# Plan Review: Category Management Implementation Plan

- **Plan**: context/changes/category-management/plan.md
- **Mode**: Deep (verification done locally, no sub-agent)
- **Date**: 2026-10-09
- **Verdict**: REVISE (after triage: all 7 findings fixed in plan → SOUND)
- **Findings**: 1 critical, 3 warnings, 3 observations

## Verdicts

| Dimension | Verdict |
|-----------|---------|
| End-State Alignment | PASS |
| Lean Execution | PASS |
| Architectural Fitness | PASS |
| Blind Spots | FAIL |
| Plan Completeness | WARNING |

## Grounding

Grounding: 7/7 existing paths ✓ (dashboard.astro, middleware.ts, Topbar.astro, http.ts, types.ts, validation.ts, smoke.mjs), 4/4 symbols ✓ (PROTECTED_ROUTES, data-category-ids, json(), RLS pattern), brief↔plan ✓, Progress↔Phase ✓ (15 rows = 15 criteria). `docs/reference/contract-surfaces.md` absent — check skipped.

## Findings

### F1 — Deploy ships code before the migration reaches production

- **Severity**: ❌ CRITICAL
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Blind Spots
- **Location**: Phase 2 §3 (dashboard filter), Migration Notes
- **Detail**: Plan dodaje `.is("archived_at", null)` do zapytania w `dashboard.astro`. Job `deploy` w `.github/workflows/ci.yml` wdraża Workera przy każdym merge na master i NIE stosuje migracji; produkcyjne migracje idą ręcznie przez `npx supabase db push` (`context/deployment/deploy-plan.md:43`, `context/archive/2026-10-08-household-foundation/plan.md:90`). Jeśli PR zostanie zmergowany przed `db push`, zapytanie o nieistniejącą kolumnę kończy się błędem, `summary` = null i każdy użytkownik widzi alert „Nie udało się wczytać danych miesiąca” (`dashboard.astro:21-24`).
- **Fix**: Dopisać do Migration Notes i do Progress ręczny krok „przed merge PR: `npx supabase db push` na produkcję” (migracja jest addytywna, więc stary kod działa na nowym schemacie).
- **Decision**: FIXED (Fix in plan)

### F2 — Plan claims CI runs pgTAP; it does not

- **Severity**: ⚠️ WARNING
- **Impact**: 🔎 MEDIUM — real tradeoff; pause to reason through it
- **Dimension**: Plan Completeness
- **Location**: Migration Notes ("CI uruchamia pgTAP/smoke")
- **Detail**: `ci.yml` ma kroki lint, `astro check`, build i smoke; nie ma `supabase test db`. pgTAP uruchamia się tylko lokalnie. Cała izolacja RLS i reguły FR-007..FR-011 są dowodzone właśnie przez pgTAP, więc regres polityk przejdzie CI niezauważony.
- **Fix A ⭐ Recommended**: Dodać `supabase test db` do joba `smoke` w `ci.yml` (po `supabase start`).
  - Strength: Job już startuje lokalny Supabase; jedna linia chroni główną obietnicę produktu (izolacja gospodarstw).
  - Tradeoff: Zmiana CI poza ścisłym zakresem S-02; `supabase start -x ...` pomija część usług, więc trzeba sprawdzić, że `test db` działa w tej konfiguracji.
  - Confidence: MED — nie uruchamiałem tego w CI.
  - Blind spot: Czas jobu i zgodność `-x` z `test db`.
- **Fix B**: Poprawić zdanie w planie na „pgTAP uruchamiane lokalnie (`npx supabase test db`)”, bez zmian w CI.
  - Strength: Zero zmian poza zakresem.
  - Tradeoff: Ochrona RLS zależy od pamiętania o ręcznym uruchomieniu.
  - Confidence: HIGH — to stan faktyczny.
  - Blind spot: None significant.
- **Decision**: FIXED (Fix A)

### F3 — Zero-row UPDATE/DELETE looks like success; PATCH body undefined

- **Severity**: ⚠️ WARNING
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Plan Completeness
- **Location**: Phase 2 §1–2 (serwis i trasy API)
- **Detail**: Przy RLS UPDATE/DELETE na cudzym lub nieistniejącym `id` nie zwraca błędu, tylko 0 wierszy (to samo potwierdzają testy `expenses`). Plan nie mówi, co zwraca `PATCH`/`DELETE` w tym przypadku, więc implementator zwróci 200 z listą mimo że nic się nie stało. `PATCH {name} lub {archived}` też nie rozstrzyga, co z obiema polami naraz lub żadnym.
- **Fix**: W Contract dopisać: schemat zod „dokładnie jedno z `name` albo `archived`” (inaczej 400); 0 zmienionych wierszy → 404 „Nie znaleziono kategorii”; dodać oba przypadki do pgTAP/smoke.
- **Decision**: FIXED (Fix in plan)

### F4 — List-returning mutations: retry trap and stale-list error

- **Severity**: ⚠️ WARNING
- **Impact**: 🔎 MEDIUM — real tradeoff; pause to reason through it
- **Dimension**: Blind Spots
- **Location**: Phase 2 §1 (każda mutacja zwraca świeżą listę), §2 (`22023` → `INVALID_REQUEST`)
- **Detail**: Gdy zapis się uda, a późniejszy odczyt listy zawiedzie, trasa zwróci błąd i klient ponowi akcję — dokładnie pułapka opisana w `buildSavedResponse` (`src/lib/services/month.ts`: błąd „invites a retry and a duplicate row”). Tu skutek to mylący komunikat: ponowne dodanie → „nazwa już istnieje”, ponowne usunięcie → 404. Drugi przypadek: `reorder_categories` odrzuca niepełną listę (`22023`), gdy w innej karcie dodano kategorię, a użytkownik dostaje ogólne „Nieprawidłowe dane formularza”.
- **Fix**: Po udanym zapisie nieudany odczyt listy daje 200 z `categories: null` (klient przeładowuje stronę), a `22023` mapować na 409 „Lista kategorii zmieniła się. Odśwież stronę.”
  - Strength: Spójne z istniejącym wzorcem `buildSavedResponse`; użytkownik nigdy nie dostaje błędu po zatwierdzonym zapisie.
  - Tradeoff: Typ `CategoryListResponse` dopuszcza null i klient potrzebuje ścieżki „przeładuj”.
  - Confidence: HIGH — ten sam wzorzec już działa w `month.ts`.
  - Blind spot: Zachowanie `window.location.reload()` w wyspie nie sprawdzone.
- **Decision**: FIXED (Fix in plan)

### F5 — Archived categories still accept expenses through the API

- **Severity**: 👁 OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Blind Spots
- **Location**: Phase 2 §3; `src/pages/api/expenses.ts:38-43`
- **Detail**: FR-009 jest spełnione na poziomie UI (siatka bez zarchiwizowanych), ale `POST /api/expenses` nie sprawdza `archived_at`. Otwarta wcześniej karta ekranu miesiąca może zapisać wydatek do właśnie zarchiwizowanej kategorii. Integralność danych nie ucierpi (historia i tak oznaczy kategorię jako zarchiwizowaną), ale plan o tym milczy.
- **Fix**: Dopisać do „What We're NOT Doing” świadomą decyzję: API wydatków nie odrzuca zarchiwizowanych kategorii w v1.
- **Decision**: FIXED (Fix in plan)

### F6 — Position of a restored category is undefined

- **Severity**: 👁 OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Blind Spots
- **Location**: Phase 1 (`reorder_categories`), Phase 2 §1 (kolejność listy)
- **Detail**: `reorder_categories` wymaga pełnego zbioru id, więc po każdej zmianie kolejności zarchiwizowane dostają numery za aktywnymi. Bez żadnego reorderu przywrócona kategoria wraca na dawne miejsce, po reorderze na koniec. Zachowanie zależy od historii operacji, a plan nie rozstrzyga pozycji po „Przywróć”.
- **Fix**: Zapisać w planie regułę „przywrócona kategoria wraca na swój zapisany `sort_order`; po reorderze zarchiwizowane są numerowane za aktywnymi” i dodać jedną asercję pgTAP.
- **Decision**: FIXED (Fix in plan)

### F7 — New write policies expose raw PostgREST writes without API checks

- **Severity**: 👁 OBSERVATION
- **Impact**: 🔎 MEDIUM — real tradeoff; pause to reason through it
- **Dimension**: Blind Spots
- **Location**: Phase 1 §1 (polityki INSERT/UPDATE/DELETE)
- **Detail**: Po dodaniu polityk zalogowany użytkownik może wołać PostgREST bezpośrednio swoim JWT, z pominięciem zod w API. Zapisy ograniczone są do własnego gospodarstwa (RLS), ale baza dopuści np. nazwę ze spacjami na brzegach czy dowolny `sort_order` (duplikaty). To nie wyciek między gospodarstwami, tylko możliwość popsucia własnej listy.
- **Fix**: Dodać `check (name = btrim(name))` w migracji (12 domyślnych nazw je spełnia) i zaakceptować resztę ryzyka jako samouszkodzenie własnych danych.
  - Strength: Reguła trim jest po stronie bazy, tak jak limit 1–50 znaków.
  - Tradeoff: Dodatkowy constraint; błąd `23514` przy bezpośrednim zapisie.
  - Confidence: HIGH — domyślne nazwy nie mają skrajnych spacji (migracja S-01 `:67-82`).
  - Blind spot: Zachowanie `btrim` dla tabulacji i nowych linii (patrz `20261008200802_trigger_trim_whitespace.sql`).
- **Decision**: FIXED (Fix in plan)
