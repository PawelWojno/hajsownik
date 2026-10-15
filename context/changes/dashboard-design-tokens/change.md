---
change_id: dashboard-design-tokens
title: Dashboard design tokens
status: impl_reviewed
created: 2026-10-15
updated: 2026-10-15
archived_at: null
---

## Notes

- **Widok:** `dashboard` — `src/pages/dashboard.astro` wraz z `Topbar.astro` i `src/components/month/*` (MonthScreen, CategoryGrid, EntrySheet, RecurringReminders, RecurringIncomeReminders).
- **Źródło tokenów:** `src/styles/global.css` (`:root`, `.dark`, `@theme inline`).
- **Wariant kontraktu:** świeży starter z martwym plikiem tokenów — widok używa klas palety (`purple-*`, `blue-*`, `slate-*`, `white/10`), a tokeny shadcn nie są czytane. Faza 1 podpina widok pod tokeny, nie wybiera nowego motywu.
- **Wstępny skan wartości zakodowanych na sztywno:** 54 trafienia (Topbar 14, EntrySheet 23, MonthScreen 7, CategoryGrid 3, Recurring*Reminders 3+3, dashboard.astro 1). `bg-cosmic` w `global.css:113` ma 3 hexy.
- **Wstępne zarzuty (do rozpisania w research.md → `## Charges`):**
  1. Brakujące tokeny: `MonthScreen.tsx:46,79`, `Topbar.astro:26,60,145`, `global.css:113`, `dashboard.astro:55`.
  2. Brakujące komponenty: surowe `<button>/<input>/<select>` w `EntrySheet.tsx` (196, 227, 245, 262, 280, 383, 427, 447, 467), `CategoryGrid.tsx:16`, `Topbar.astro:101`; w `ui/` są tylko `button` i `drawer`.
  3. Przypadkowa architektura: aplikacja ciemna „na sztywno” (`Layout.astro:21` `color-scheme: dark`), tokeny `.dark` nieużywane; blok błędu w `dashboard.astro:53` poza tokenem `destructive`.
  4. Reguła agenta: `CLAUDE.md` ma sekcję UI, ale kod ją łamie; sprawdzić `AGENTS.md`.
- Poza zakresem: inne widoki (history, settings, auth), rebranding.
