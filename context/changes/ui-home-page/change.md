---
change_id: ui-home-page
title: Projekt strony startowej
status: impl_reviewed
github_issue: 31
created: 2026-10-16
updated: 2026-10-17
archived_at: null
---

## Notes

Projekt strony startowej

**Cel.** Strona główna (`src/pages/index.astro`, komponent `Welcome.astro`) ma w kilka sekund pokazać, co robi Hajsownik, i zachęcić do założenia konta. Obecne karty z cechami zostają zastąpione jednym hero z przewijanym podglądem.

**Wzorzec wizualny.** Szkic `hero-karuzela.html` (poza repozytorium) jest referencją wizualną, nie specyfikacją kodu. Źródłem prawdy są tokeny w `src/styles/global.css` i istniejące komponenty. Szkic najpierw kopiujemy do tego katalogu zmiany jako `reference/hero-karuzela.html`.

**Zakres.**
- Nagłówek i krótki opis (teksty z szkicu, po polsku).
- Przyciski: "Załóż konto" jako główne wezwanie (duże), "Zaloguj się" jako link. Na komputerze nad równaniem/podglądem, na telefonie pod nagłówkiem.
- Karuzela z trzema widokami: (1) ekran miesiąca z formularzem "Dodaj wydatek", (2) przepływ pieniędzy, (3) wgląd w budżet z lupą.
- Strzałki po bokach obszaru, trzy paski pod nim pokazujące aktywny widok (klik przechodzi do widoku), przeciąganie palcem/myszką, sterowanie klawiaturą, zapętlenie.
- Nagłówek ekranu miesiąca generowany dynamicznie przez `formatMonthLabel` / `currentMonthStart` z `src/lib/dates.ts` (strefa Europe/Warsaw). Brak wpisanego na sztywno miesiąca.
- Na grafikach dopisek "Dane przykładowe".

**Poza zakresem.**
- Logika logowania, rejestracji i middleware.
- Ekran miesiąca w aplikacji (grafika jest tylko makietą na stronie głównej).
- Automatyczne przewijanie karuzeli.
- Cele, prognozy, limity kategorii, alerty, AI (zgodnie z `prd.md`, sekcja Non-Goals).

**Ograniczenia.**
- Kolory wyłącznie z tokenów (`bg-primary`, `text-muted-foreground`, `text-success` itd.), bez literałów takich jak `bg-purple-600` czy `#...`. Gradient tła przez istniejący `bg-cosmic`.
- Przyciski i linki z komponentów `src/components/ui/`. Brakujące elementy dodajemy z rejestru shadcn.
- Układ bez poziomego przewijania strony przy 390 px i przy szerokości komputera.
- Dostępność: etykiety `aria` dla strzałek i pasków, widoczny fokus (`focus-visible`), karuzela obsługiwana klawiaturą.
- Grafiki SVG z tokenami w `currentColor`/`var(--...)`, tak żeby działały w trybie jasnym i ciemnym.

**Do ustalenia w `/10x-research`.**
- Czy grafiki SVG mają być inline w komponencie czy w `public/` (brak decyzji).
- Czy karuzela ma być komponentem React (wyspa) czy Astro z minimalnym skryptem.
- Jak sprawdzić na mobile, że strzałki nie zasłaniają treści (zrzut przez Playwright).
