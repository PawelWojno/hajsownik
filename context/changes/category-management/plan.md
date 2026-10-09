# Category Management Implementation Plan

## Overview

Użytkownik może dodawać, zmieniać nazwę, przesuwać, archiwizować, przywracać i usuwać kategorie (FR-007..FR-011) na stronie `/settings/categories`, otwieranej z rozwijanego menu „Ustawienia” w `Topbar`. Ekran miesiąca pokazuje tylko aktywne kategorie.

## Current State Analysis

- `categories` jest dziś tylko do odczytu: jedyna polityka to `categories_select_own` (`supabase/migrations/20261008233243_first_expense_and_income.sql:46-48`). Brak INSERT/UPDATE/DELETE → default-deny.
- Tabela ma `unique (household_id, name)` (case-sensitive, `:11`), `sort_order int not null` bez defaultu, `household_id` bez defaultu (`:5-14`), brak kolumny archiwizacji.
- `expenses` łączy się z kategoriami złożonym FK `(household_id, category_id)` bez `on delete` (`:26`) → usunięcie użytej kategorii kończy się błędem `23503`; FK nie podlega RLS, więc blokuje też wydatki innych członków gospodarstwa.
- Jedyny odczyt: `src/pages/dashboard.astro:19` (`select id, name … order sort_order`, bez filtra).
- Wzorzec API: `src/pages/api/expenses.ts` (401, `createClient`, zod `safeParse`, mapowanie kodów DB na polskie komunikaty). `json()` w `src/lib/http.ts:3` ma typ `SavedEntryResponse | ApiError`.
- `PROTECTED_ROUTES = ["/dashboard"]` (`src/middleware.ts:4`). `Topbar.astro` ma tylko „Miesiąc” i „Wyloguj”.
- Test pgTAP asercji „UPDATE/DELETE = 0 wierszy” dotyczy `expenses`, nie `categories` (`supabase/tests/database/expenses_income.test.sql:~99-103`) — zmiana polityk kategorii go nie ruszy. `plan(29)` w tym pliku zostaje; nowe testy idą do nowego pliku.

## Desired End State

Po zalogowaniu: „Ustawienia” → „Kategorie” otwiera listę kategorii z akcjami; zmiany od razu widać na ekranie miesiąca (zarchiwizowane znikają z siatki wyboru, zmieniona nazwa i kolejność są widoczne). Zarchiwizowane kategorie są w osobnej sekcji z przyciskiem „Przywróć”. Weryfikacja: pgTAP, lint, `astro check`, build, smoke oraz ręczny przebieg w przeglądarce.

### Key Discoveries

- Zmiana nazwy jest wsteczna „za darmo”: wydatki trzymają `category_id`, nie nazwę (`…:19`) → FR-010 to zwykły UPDATE `name`; UI musi tylko jasno o tym informować.
- Reguła FR-008 jest już egzekwowana przez bazę (FK `23503`) — API tylko mapuje błąd na komunikat kierujący do archiwizacji. Brak osobnej kontroli „czy użyta” (jedno źródło prawdy).
- Każda nowa polityka musi używać `(select public.current_household_id())` (`context/foundation/lessons.md`, reguła „RLS policies wrap current_household_id() in (select …)”).
- Funkcje, których użytkownik nie ma wywoływać bezpośrednio, tracą EXECUTE; funkcje użytkownika: `revoke … from public, anon; grant … to authenticated` (wzorzec `month_summary`, `…:135-136`).

## What We're NOT Doing

- Drag-and-drop (reorder przyciskami ↑/↓).
- Widok historii z oznaczaniem zarchiwizowanych (S-06); S-02 tylko zachowuje model danych (zarchiwizowana kategoria zostaje w bazie, użyta nie jest usuwalna).
- Inne gałęzie „Ustawień” (osoby w gospodarstwie) — menu projektujemy pod rozbudowę, ale dodajemy tylko „Kategorie”.
- Wiele ról/uprawnień w gospodarstwie.
- Limit liczby kategorii oraz ikony/kolory kategorii — odłożone na później (zapisane w `## Parked` w `context/foundation/roadmap.md`).
- Zmiana domyślnych 12 kategorii ani seeda.
- Odrzucanie zarchiwizowanych kategorii w `POST /api/expenses`: FR-009 realizuje UI (siatka bez zarchiwizowanych). Otwarta wcześniej karta może jeszcze zapisać wydatek do właśnie zarchiwizowanej kategorii — świadomie akceptowane w v1, bo dane pozostają spójne, a historia oznaczy kategorię jako zarchiwizowaną.

## Implementation Approach

Trzy fazy od dołu: baza (z testami) → API/serwis → UI/nawigacja. Mutacje zwracają świeżą listę kategorii, więc klient podmienia stan jednym ruchem (bez ręcznego łatania). Trasa `/settings/categories`; `/settings` w `PROTECTED_ROUTES` obejmuje przyszłe gałęzie. Zarchiwizowana kategoria dalej „trzyma” swoją nazwę w indeksie unikalności, więc przywrócenie nigdy nie koliduje.

## Critical Implementation Details

- **State sequencing:** nowa migracja musi najpierw usunąć constraint `categories_household_id_name_key` (domyślna nazwa dla `unique (household_id, name)`) i dopiero potem utworzyć indeks `unique (household_id, lower(name))`; sprawdzić nazwę w `\d public.categories` przed napisaniem `drop constraint`. Istniejące dane (12 kategorii) są wolne od duplikatów bez względu na wielkość liter.
- **Reorder:** `reorder_categories(p_ids uuid[])` musi odrzucić tablicę, która nie jest dokładnie zbiorem wszystkich kategorii widocznych dla wywołującego (RLS), żeby nie zostawić luk ani duplikatów w `sort_order`.

## Phase 1: Baza danych

### Overview

Schemat, RLS i funkcje potrzebne do pięciu operacji, z testami pgTAP.

### Changes Required

#### 1. Migracja `supabase/migrations/<timestamp>_category_management.sql`

**File**: `supabase/migrations/<YYYYMMDDHHmmss>_category_management.sql`

**Intent**: Dodać archiwizację, case-insensitive unikalność nazw, scoping po gospodarstwie i zapisy kategorii objęte RLS.

**Contract**:
- `alter table categories add column archived_at timestamptz null`; `alter column household_id set default public.current_household_id()`.
- `add constraint categories_name_trimmed check (name = btrim(name))` — reguła trim po stronie bazy (polityki INSERT/UPDATE pozwalają na zapis bezpośrednio przez PostgREST z pominięciem zod; `btrim` bez listy znaków obcina tylko spacje, resztę znaków białych pilnuje zod); 12 domyślnych nazw je spełnia.
- Drop `categories_household_id_name_key`; `create unique index categories_household_lower_name_idx on categories (household_id, lower(name))`.
- Polityki dla roli `authenticated`: `categories_insert_own` (`with check`), `categories_update_own` (`using` + `with check`), `categories_delete_own` (`using`), wszystkie z `household_id = (select public.current_household_id())`.
- `public.add_category(p_name text) returns uuid` — SECURITY INVOKER, `set search_path = ''`, wstawia z `sort_order = coalesce(max(sort_order), 0) + 1` dla gospodarstwa wywołującego.
- `public.reorder_categories(p_ids uuid[]) returns void` — SECURITY INVOKER, `set search_path = ''`; ustawia `sort_order` wg pozycji w tablicy, `raise exception` (errcode `22023`), gdy tablica ≠ zbiór wszystkich widocznych kategorii.
- Oba: `revoke execute … from public, anon; grant execute … to authenticated`.

#### 2. Testy pgTAP

**File**: `supabase/tests/database/category_management.test.sql` (nowy; wzorzec z `expenses_income.test.sql`)

**Intent**: Udowodnić izolację między gospodarstwami i reguły FR-007..FR-011 na poziomie bazy.

**Contract**: A może insert/rename/archive/restore własnej kategorii; A nie może zmodyfikować, usunąć ani wstawić w gospodarstwie B (0 wierszy / `42501`); duplikat nazwy różniący się wielkością liter → `23505`; nazwa ze spacją na brzegu → `23514`; `add_category` daje kolejny `sort_order`; `reorder_categories` zmienia kolejność, numeruje zarchiwizowane za aktywnymi i odrzuca niepełną tablicę (`22023`); przywrócona kategoria wraca na swój zapisany `sort_order` (przed reorderem na dawne miejsce, po reorderze na koniec listy aktywnych); delete użytej kategorii → `23503`, delete nieużytej (także zarchiwizowanej) działa; `anon` nie wykona funkcji.

#### 3. pgTAP w CI

**File**: `.github/workflows/ci.yml`

**Intent**: Izolacja RLS i reguły kategorii mają być sprawdzane przy każdym PR, nie tylko lokalnie.

**Contract**: w jobie `smoke`, po kroku `Start local Supabase`, nowy krok `supabase test db`. Sprawdzić, że działa z flagą `-x ...` użytą w `supabase start`.

### Success Criteria

#### Automated Verification:

- Migracja stosuje się czysto: `npx supabase db reset`
- Testy bazy przechodzą (w tym istniejące): `npx supabase test db`
- Job `smoke` w CI uruchamia `supabase test db` i jest zielony

#### Manual Verification:

- W Studio nowa migracja nie zmienia 12 domyślnych kategorii ani ich kolejności.
- Istniejące konto nadal widzi swoje kategorie.

**Implementation Note**: Po ukończeniu fazy i zielonych testach automatycznych zatrzymaj się na ręczne potwierdzenie przed następną fazą.

---

## Phase 2: Serwis i API

### Overview

Endpointy mutujące kategorie oraz odczyt pomijający zarchiwizowane na ekranie miesiąca.

### Changes Required

#### 1. Typy, walidacja, serwis

**File**: `src/types.ts`, `src/lib/validation.ts`, `src/lib/http.ts`, `src/lib/services/categories.ts` (nowy)

**Intent**: Wspólny kontrakt kategorii zarządzanych i logika wywołań Supabase poza trasami.

**Contract**: `ManagedCategory { id; name; archived: boolean }`, `CategoryListResponse { categories: ManagedCategory[] | null }` (dopisane do unii w `json()`; `null` = zapis udany, ale odczyt świeżej listy zawiódł — wzorzec `buildSavedResponse` w `src/lib/services/month.ts`, błąd po zatwierdzonym zapisie zachęcałby do ponowienia akcji); `categoryNameField` (zod: trim, 1–50 znaków, te same granice co DB); serwis: `listCategories`, `addCategory`, `renameCategory`, `setArchived`, `deleteCategory`, `reorderCategories` — każdy zwraca świeżą listę (aktywne wg `sort_order`, potem zarchiwizowane).

#### 2. Trasy API

**File**: `src/pages/api/categories/index.ts` (POST dodanie), `src/pages/api/categories/[id].ts` (PATCH `{name}` lub `{archived}`, DELETE), `src/pages/api/categories/reorder.ts` (POST `{ids}`)

**Intent**: Cienkie trasy według wzorca `api/expenses.ts`: `prerender = false`, 401, zod, mapowanie błędów.

**Contract**: `23505` → „Kategoria o tej nazwie już istnieje”; `23503` przy DELETE → „Ta kategoria ma wydatki. Zarchiwizuj ją zamiast usuwać.” (FR-008); `22023` (nieaktualna lista przy reorderze, np. kategoria dodana w innej karcie) → 409 „Lista kategorii zmieniła się. Odśwież stronę.”; reszta → `SAVE_FAILED` 500; `id` walidowane jako uuid. `PATCH` przyjmuje dokładnie jedno z `name` albo `archived` (oba lub żadne → 400). Przy RLS UPDATE/DELETE cudzego lub nieistniejącego `id` nie zgłasza błędu, tylko zmienia 0 wierszy, więc serwis sprawdza liczbę zmienionych wierszy (`.select()` na wyniku) i trasa zwraca 404 „Nie znaleziono kategorii”.

#### 3. Filtr na ekranie miesiąca

**File**: `src/pages/dashboard.astro`

**Intent**: Siatka wyboru kategorii pokazuje tylko aktywne (FR-009).

**Contract**: dodać `.is("archived_at", null)` do zapytania na linii 19; `data-category-ids` (kontrakt smoke) obejmuje wtedy tylko aktywne.

### Success Criteria

#### Automated Verification:

- Lint przechodzi: `npm run lint`
- Typy i Astro: `npx astro check`
- Build przechodzi: `npm run build`

#### Manual Verification:

- Z ciasteczkiem sesji `curl` na każdy endpoint zwraca oczekiwane kody: 200 z listą, 400 dla pustej/za długiej/duplikatu nazwy, 400 z komunikatem o archiwizacji dla użytej kategorii, 401 bez sesji.
- Zarchiwizowana kategoria znika z siatki na `/dashboard`.

**Implementation Note**: Po zielonej weryfikacji automatycznej zatrzymaj się na ręczne potwierdzenie. (Po buildzie zrestartuj dev server i odśwież stronę twardo.)

---

## Phase 3: UI i nawigacja

### Overview

Menu „Ustawienia”, strona zarządzania i zabezpieczenie trasy.

### Changes Required

#### 1. Menu Ustawienia

**File**: `src/components/Topbar.astro`

**Intent**: Rozwijane menu „Ustawienia” z pierwszą pozycją „Kategorie”, gotowe na kolejne gałęzie.

**Contract**: natywne `<details>/<summary>` (bez JS) z listą linków; link „Kategorie” → `/settings/categories`; wygląd spójny z obecnym paskiem.

#### 2. Ochrona trasy

**File**: `src/middleware.ts`

**Intent**: Niezalogowany nie wchodzi na stronę ustawień.

**Contract**: `PROTECTED_ROUTES = ["/dashboard", "/settings"]` (dopasowanie `startsWith`).

#### 3. Strona i wyspa React

**File**: `src/pages/settings/categories.astro`, `src/components/settings/CategoryManager.tsx`, `src/hooks/useCategoryActions.ts`

**Intent**: Strona SSR ładuje wszystkie kategorie (z `archived_at`), wyspa obsługuje akcje i podmienia stan odpowiedzią API.

**Contract**: sekcja „Aktywne” (↑/↓, zmiana nazwy inline, „Archiwizuj”, „Usuń”) i „Zarchiwizowane” (oznaczone, „Przywróć”, „Usuń”); formularz dodawania; widoczna informacja przy zmianie nazwy, że dotyczy też dawnych wydatków (FR-010); komunikaty błędów z API wyświetlane przy akcji; odpowiedź z `categories: null` lub 409 → `window.location.reload()`; ↑ na pierwszej i ↓ na ostatniej aktywnej pozycji wyłączone; React bez dyrektyw „use client”, `cn()` do klas, komponenty z `src/components/ui`.

#### 4. Smoke test

**File**: `scripts/smoke.mjs`

**Intent**: Zabezpieczyć nowy przepływ po aktualizacjach zależności.

**Contract**: po zalogowaniu: dodanie kategorii → 200; duplikat różniący się wielkością liter → 400; archiwizacja → znika z `data-category-ids`; usunięcie nieużytej → 200; `PATCH` z obydwoma polami → 400; `DELETE` nieistniejącego `id` → 404; `/settings/categories` bez sesji → przekierowanie na logowanie.

### Success Criteria

#### Automated Verification:

- Lint, typy, build: `npm run lint && npx astro check && npm run build`
- Smoke przechodzi na serwerze podglądu: `npm run smoke`

#### Manual Verification:

- W przeglądarce (mobile i desktop): dodanie, zmiana nazwy, przesunięcie, archiwizacja, przywrócenie i usunięcie działają; błędy są czytelne.
- Użyta kategoria nie da się usunąć i pojawia się wskazówka o archiwizacji.
- Zmiana kolejności i nazwy jest widoczna w siatce na `/dashboard`.
- Menu „Ustawienia” otwiera się i prowadzi do kategorii; po wylogowaniu `/settings/categories` przekierowuje na logowanie.
- Przed merge PR migracja jest wypchnięta na produkcję: `npx supabase db push` (job `deploy` w CI nie stosuje migracji, a kod z filtrem `archived_at` bez niej psuje `/dashboard`).

---

## Testing Strategy

### Unit / DB Tests

- pgTAP `category_management.test.sql` (izolacja, unikalność lower(name), kolejność, FK przy usuwaniu, uprawnienia funkcji).

### Integration Tests

- `scripts/smoke.mjs` — przepływ dodaj/duplikat/archiwizuj/usuń + ochrona trasy.

### Manual Testing Steps

1. Zaloguj się, wejdź w Ustawienia → Kategorie, dodaj „Zwierzęta”, zmień nazwę na „Pupil”.
2. Spróbuj dodać „pupil” → odrzucone jako duplikat.
3. Dodaj wydatek w „Jedzenie”, spróbuj usunąć „Jedzenie” → wskazówka o archiwizacji; zarchiwizuj, sprawdź brak w siatce, przywróć.
4. Przesuń kategorię, wróć na „Miesiąc” i sprawdź kolejność.

## Performance Considerations

Brak istotnych: lista ma kilkanaście wierszy; polityki używają `(select …)`, więc funkcja gospodarstwa liczy się raz na zapytanie.

## Migration Notes

Migracja jest addytywna (kolumna nullable, nowy indeks, nowe polityki). Istniejące kategorie pozostają aktywne (`archived_at null`). Kolejność wdrożenia: najpierw `npx supabase db push` na produkcję (job `deploy` w CI nie stosuje migracji), dopiero potem merge PR — inaczej `/dashboard` odpytuje nieistniejącą kolumnę `archived_at`. Wdrożenie: zmiana kodu → branch + PR (polityka git: kod aplikacji nie idzie bezpośrednio na master); CI uruchamia pgTAP (nowy krok w jobie `smoke`) i smoke.

## References

- Related research: `context/changes/category-management/research.md`
- PRD: `context/foundation/prd.md:73-81` (FR-007..FR-011)
- Pattern: `src/pages/api/expenses.ts`, `supabase/migrations/20261008233243_first_expense_and_income.sql:46-62,135-136`
- Lessons: `context/foundation/lessons.md`

## Progress

> Convention: `- [ ]` pending, `- [x]` done. Append ` — <commit sha>` when a step lands. Do not rename step titles. See `references/progress-format.md`.

### Phase 1: Baza danych

#### Automated

- [x] 1.1 Migracja stosuje się czysto: `npx supabase db reset`
- [x] 1.2 Testy bazy przechodzą (w tym istniejące): `npx supabase test db`
- [ ] 1.3 Job `smoke` w CI uruchamia `supabase test db` i jest zielony

#### Manual

- [x] 1.4 W Studio nowa migracja nie zmienia 12 domyślnych kategorii ani ich kolejności
- [x] 1.5 Istniejące konto nadal widzi swoje kategorie

### Phase 2: Serwis i API

#### Automated

- [ ] 2.1 Lint przechodzi: `npm run lint`
- [ ] 2.2 Typy i Astro: `npx astro check`
- [ ] 2.3 Build przechodzi: `npm run build`

#### Manual

- [ ] 2.4 `curl` z sesją na każdy endpoint zwraca oczekiwane kody (200 / 400 / 400 z komunikatem o archiwizacji / 401)
- [ ] 2.5 Zarchiwizowana kategoria znika z siatki na `/dashboard`

### Phase 3: UI i nawigacja

#### Automated

- [ ] 3.1 Lint, typy, build: `npm run lint && npx astro check && npm run build`
- [ ] 3.2 Smoke przechodzi na serwerze podglądu: `npm run smoke`

#### Manual

- [ ] 3.3 Dodanie, zmiana nazwy, przesunięcie, archiwizacja, przywrócenie i usunięcie działają (mobile i desktop)
- [ ] 3.4 Użyta kategoria nie da się usunąć, pojawia się wskazówka o archiwizacji
- [ ] 3.5 Zmiana kolejności i nazwy widoczna w siatce na `/dashboard`
- [ ] 3.6 Menu „Ustawienia” działa; po wylogowaniu `/settings/categories` przekierowuje na logowanie
- [ ] 3.7 Przed merge PR migracja jest wypchnięta na produkcję: `npx supabase db push`
