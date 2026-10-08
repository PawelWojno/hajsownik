# Rules for AI

This file provides guidance to AI Agent when working with code in this repository.

## Commands

- `npm run dev` — start dev server (Cloudflare workerd runtime)
- `npm run build` — production build (SSR via `@astrojs/cloudflare`)
- `npm run preview` — preview production build
- `npm run lint` — ESLint with type-checked rules
- `npm run lint:fix` — auto-fix lint issues
- `npm run format` — Prettier (includes prettier-plugin-astro + prettier-plugin-tailwindcss); `printWidth` is 120, not the 80-column default
- `npm run smoke` — dependency-free auth-flow smoke test (`scripts/smoke.mjs`) against a running server, `BASE_URL` env (default `http://localhost:4321`). Run after dependency upgrades; CI runs it against the production preview with a local Supabase.

Pre-commit hooks: husky + lint-staged runs `eslint --fix` on `*.{ts,tsx,astro}` and `prettier --write` on `*.{json,css,md}`.

## Architecture

**Astro 7 SSR app** with React 19 islands, Tailwind 4, Supabase auth, and shadcn/ui components. Deployed to Cloudflare Workers.

### Rendering mode

Full server-side rendering (`output: "server"` in astro.config.mjs). All pages are server-rendered by default. API routes must export `const prerender = false`.

### Auth flow

- `src/lib/supabase.ts` — creates a Supabase SSR client using `@supabase/ssr` with cookie-based sessions. Uses `astro:env/server` for `SUPABASE_URL` and `SUPABASE_KEY` (server-only secrets declared in astro.config.mjs `env.schema`).
- `src/middleware.ts` — runs on every request, resolves the current user, attaches to `context.locals.user`. Redirects unauthenticated users away from routes listed in `PROTECTED_ROUTES`.
- API endpoints: `src/pages/api/auth/{signin,signup,signout}.ts`
- Auth pages: `src/pages/auth/{signin,signup,confirm-email}.astro`
- Protected page example: `src/pages/dashboard.astro`

### Key conventions

- **Path alias**: `@/*` maps to `./src/*` (tsconfig paths).
- **Astro components** for static content/layout; **React components** only when interactivity is needed.
- **Tailwind class merging**: use the `cn()` helper from `@/lib/utils` (clsx + tailwind-merge) for conditional/merged class names. Do not concatenate class strings manually.
- **shadcn/ui**: components live in `src/components/ui/`, "new-york" style variant. Install new ones with `npx shadcn@latest add [name]`.
- **API routes**: use uppercase `GET`, `POST` exports; validate input with zod.
- **Supabase migrations**: `supabase/migrations/` using naming format `YYYYMMDDHHmmss_short_description.sql`. Always enable RLS on new tables with granular per-operation, per-role policies.
- **React**: no Next.js directives ("use client" etc.). Extract hooks to `src/hooks/` (matches the `@/hooks` alias in `components.json`).
- **Services/helpers** go in `src/lib/` (or `src/lib/services/` for extracted business logic).
- **Shared types** (entities, DTOs) go in `src/types.ts`.

### Environment

- Node.js v22.14.0 (see `.nvmrc`)
- Env vars: `SUPABASE_URL`, `SUPABASE_KEY` (copy `.env.example` to `.env` for Node, or `.dev.vars` for Cloudflare local dev)
- Local Supabase: `npx supabase start` (requires Docker)
- Cloudflare local dev: secrets go in `.dev.vars` (gitignored)
- Deploy: `npx wrangler deploy` (requires Cloudflare account + `wrangler` auth)

## CI

GitHub Actions workflow (`.github/workflows/ci.yml`) runs two jobs on every push and PR to master:
- `ci` — `npm ci` → `astro sync` → lint → `astro check` → build. Requires `SUPABASE_URL` and `SUPABASE_KEY` repository secrets.
- `smoke` — spins up a local Supabase CLI instance, builds, runs `npm run preview`, then `scripts/smoke.mjs` against it. No secrets needed.

## Hard constraints

Never write to `context/archive/` — archived changes are immutable. If a resolved target path starts with `context/archive/`, stop with: "This change is archived. Open a new change with `/10x-new` instead."

## Foundation paths

Maintained by hand outside the `10x-cli` managed block below, since that block is fully overwritten on every lesson sync. Update this list when a new lesson's "Ścieżki foundation/fundamentowe" section introduces a path not yet listed here.

- `context/foundation/prd.md` — PRD (input, from `/10x-prd`)
- `context/foundation/tech-stack.md` — chosen stack (handoff from `/10x-tech-stack-selector`)
- `context/foundation/lessons.md` — recurring rules/pitfalls log (`/10x-lesson`, append-only)
- `docs/reference/contract-surfaces.md` — canonical name registry
- `context/changes/bootstrap-verification/verification.md` — bootstrap run audit log (`/10x-bootstrapper`)
- `AGENTS.md` / `CLAUDE.md` (and directory-level variants) — output of `/10x-agents-md`
- `context/foundation/infrastructure.md` — deployment platform recommendation (`/10x-infra-research`)
- `context/deployment/deploy-plan.md` — approved Plan Mode deploy plan (audit trail)
- `context/foundation/roadmap.md` — MVP roadmap, vertical slices (`/10x-roadmap`)
- `context/changes/<change-id>/{change.md,plan.md,plan-brief.md}` — per-change identity, implementation plan, compressed handoff (`/10x-new`, `/10x-plan`)
- `context/changes/<change-id>/reviews/` — review output (`/10x-plan-review`, `/10x-impl-review`)
- `context/changes/<change-id>/research.md` — internal codebase research (`/10x-research`)
- `context/changes/<change-id>/frame.md` — problem framing, when needed (`/10x-frame`)

<!-- BEGIN @przeprogramowani/10x-cli -->

## Zestaw narzędzi AI 10xDevs — Moduł 2, Lekcja 4

Przygotuj się na trudniejszy strumień implementacji z **łańcuchem planowania opartym na badaniach**:

```
internal research (/10x-research) + external research (exa.ai, Context7) -> /10x-plan -> /10x-implement -> success
```

Lekcja koncentruje się na rozróżnianiu badań wewnętrznych od zewnętrznych oraz wykorzystywaniu dowodów do uzasadniania decyzji planistycznych.

### Router zadań — od czego zacząć

| Umiejętność | Użyj jej, gdy |
| --- | --- |
| **Badania wewnętrzne (temat lekcji)** | |
| `/10x-research <change-id>` | Potrzebujesz dowodów z istniejącej bazy kodu — wzorców, konwencji, punktów integracji lub istniejących implementacji. Uruchamia równoległe subagentów w repozytorium i zapisuje ustrukturyzowane ustalenia w `research.md`. |
| **Badania zewnętrzne (temat lekcji)** | |
| exa.ai | Potrzebujesz natywnego dla AI wyszukiwania w sieci do porównywania bibliotek, sprawdzonych praktyk lub kontekstu ekosystemu, na które baza kodu nie może odpowiedzieć. |
| Context7 (`resolve-library-id` → `get-library-docs`) | Potrzebujesz aktualnej, bieżącej dokumentacji dla konkretnej biblioteki lub frameworka. Najpierw rozwiązuje identyfikator biblioteki, a następnie pobiera odpowiednie strony dokumentacji. |
| **Koło zapasowe do ramowania problemu** | |
| `/10x-frame <change-id>` | Plan nie może się ustabilizować, plan nie przynosi oczekiwanych rezultatów lub utrzymujący się dryf ciągle psuje implementację. Użyj jako wyjścia awaryjnego dla osobnego problemu (zademonstrowanego na przykładzie Space Explorers), a nie jako rytuału przed badaniami. |
| **Planowanie i wykonanie** | |
| `/10x-plan <change-id>` / `/10x-implement <change-id> phase <n>` | Użyj tego samego łańcucha planowania i wykonania co w Lekcji 2, teraz z dowodami z wcześniejszych badań zasilającymi plan. |

### Dyscyplina badawcza

- Badania wewnętrzne (`/10x-research`) odpowiadają na pytanie „co nasza baza kodu już robi?” — wzorce, schematy, konwencje, punkty integracji.
- Badania zewnętrzne (exa.ai, Context7) odpowiadają na pytanie „co powinniśmy zrobić?” — możliwości bibliotek, dokumentacja API, sprawdzone praktyki ekosystemu.
- Połącz oba rodzaje jako dane wejściowe do `/10x-plan` poparte dowodami. Plan bez dowodów badawczych dla nietrywialnego strumienia to zgadywanie.
- Dokumentacja przyjazna agentom (`llms.txt`, markdown-for-agents, endpointy `/md`) jest sygnałem jakości przy wyborze biblioteki — biblioteki publikujące dokumentację czytelną dla agentów integrują się szybciej.

### `/10x-frame` jako koło zapasowe

Trzy sygnały, że należy sięgnąć po `/10x-frame`:
1. Plan nie może się ustabilizować — badania otwierają coraz więcej pytań zamiast zawężać je do kontraktu.
2. Plan nie przynosi rezultatów — implementacja wielokrotnie nie spełnia kryteriów sukcesu.
3. Utrzymujący się dryf — implementacja ciągle odbiega od planu w sposób sugerujący, że problem został błędnie ujęty.

Zademonstrowano na przykładzie Space Explorers, a nie na ścieżce SRS. Jest to wyjście awaryjne, a nie obowiązkowy krok.

### Ścieżki używane w tej lekcji

- `context/changes/<change-id>/research.md` - wynik badań wewnętrznych
- `context/changes/<change-id>/frame.md` - wynik ramowania problemu, gdy jest potrzebny
- `context/changes/<change-id>/plan.md` - kontrakt implementacyjny poparty dowodami
- `context/foundation/lessons.md` - powtarzające się reguły i pułapki

Umiejętności nie mogą zapisywać do `context/archive/`. Zarchiwizowane zmiany są niezmienne; jeśli rozwiązana ścieżka docelowa zaczyna się od `context/archive/`, przerwij z komunikatem: „This change is archived. Open a new change with `/10x-new` instead.”

<!-- END @przeprogramowani/10x-cli -->
