---
date: 2026-10-17T21:02:23+02:00
researcher: Claude (Sonnet 5.5)
git_commit: c7ad1d3
branch: master
repository: Hajsownik
topic: "Audyt wspólnych komponentów auth (FormField, SubmitButton, PasswordToggle) względem tokenów z global.css"
tags: [research, ui, auth, tokens, FormField, SubmitButton, PasswordToggle]
status: complete
last_updated: 2026-10-17
last_updated_by: Claude (Sonnet 5.5)
---

# Research: wspólne komponenty auth a kontrakt tokenów

**Date**: 2026-10-17T21:02:23+02:00 · **Git Commit**: c7ad1d3 · **Branch**: master · **Repository**: Hajsownik

## Research Question

Które wartości i komponenty w `FormField.tsx`, `SubmitButton.tsx` i `PasswordToggle.tsx` łamią kontrakt systemu projektowego (tokeny z `src/styles/global.css`, komponenty z `src/components/ui`)? Strony i `*Form.tsx` są poza zakresem.

## Summary

Wariant kontraktu: **istniejący system projektowy**. Tokeny potrzebne tym komponentom już istnieją w `:root` i `.dark` (`primary`, `primary-hover`, `ring`, `destructive`, `input`, `border`, `muted-foreground`, `foreground`; `global.css:15-27,68-80`). Są też gotowe `ui/input`, `ui/label` i `ui/button`. Skan na tych trzech plikach daje 8 trafionych linii (FormField 5, SubmitButton 2, PasswordToggle 1; grep zwraca linie, nie pojedyncze klasy). Wcześniejsze „9 trafień” z wstępnego audytu było błędnym zliczeniem. Prawdopodobnie nie trzeba nowych tokenów. Te trzy komponenty importują 4 formularze (`ForgotPasswordForm`, `SignInForm`, `SignUpForm`, `UpdatePasswordForm`), więc zmiana wyglądu dotknie wszystkich czterech stron auth bez edycji formularzy, o ile propsy zostaną bez zmian.

## Charges

1. **Brakujące tokeny, `FormField.tsx:6,37,41,53,59`.** Klasy `bg-white/10`, `border-white/20`, `text-white`, `placeholder-white/40`, `text-blue-100/80`, `focus:ring-purple-400`, `border-red-400/60`, `focus:ring-red-400`, `text-red-300` zamiast `input`/`border`, `foreground`, `muted-foreground`, `ring`, `destructive`. Wpływ: kolor fokusu i błędu pola nie podąża za tokenami, więc zmiana `--ring` lub `--destructive` rozjedzie auth z resztą aplikacji.
2. **Brakujący współdzielony komponent, `FormField.tsx:6,37,49-54`.** Ręczny `<input>` i `<label>` zamiast `ui/input.tsx` (ma `focus-visible`, `aria-invalid`, `disabled`) i `ui/label.tsx`. Wpływ: pole ma fokus `focus:ring-2` zamiast tokenowego `focus-visible:ring-ring/50` i nie ma wyglądu disabled.
3. **Brakujący współdzielony komponent, `SubmitButton.tsx:18,22`.** `Button` jest nadpisywany `bg-purple-600 hover:bg-purple-500`, choć wariant `default` ma już `bg-primary hover:bg-primary-hover` (`ui/button.tsx:15`). Spinner używa `border-white/30 border-t-white` (`SubmitButton.tsx:22`). Wpływ: hover przycisku pochodzi z palety, nie z tokenu `primary-hover`.
4. **Brakujące tokeny i stan, `PasswordToggle.tsx:13`.** Przycisk ma `text-white/40 hover:text-white/70` i nie ma stylu `focus-visible`. Wpływ: użytkownik klawiatury nie widzi tokenowego fokusu na ikonie oka.
5. **Dostępność, `FormField.tsx:49-63`.** `<input>` nie dostaje `aria-invalid` ani `aria-describedby`, a `<p>` z błędem (linia 59) nie ma `id`. Wpływ: czytnik ekranu nie łączy błędu z polem. `aria-invalid` włączy też styl błędu z `ui/input` (`aria-invalid:border-destructive`, `input.tsx:12`).
6. **Przypadkowa architektura (deferred, poza zakresem).** `settings/RecurringManager.tsx:14-18,63-70` i `settings/RecurringIncomeManager.tsx` (komentarze w liniach 18 i 63) kopiują wygląd FormField klasami palety (`purple-400`, `red-400/60`, `red-300`, `blue-100/80`). Powód odroczenia: to osobny widok i osobna zmiana.

## Detailed Findings

### Tokeny

- W `.dark` `--input` to `oklch(1 0 0 / 20%)`, `--border` to `oklch(1 0 0 / 10%)` (`global.css:78-79`). `ui/input` używa `border-input` i `dark:bg-input/30` (`input.tsx:11`), więc tło pola w dark będzie jaśniejsze o ok. 6% bieli zamiast dotychczasowych 10% (`bg-white/10`). Różnica jest mała, do oceny na zrzucie. Nie zmieniać globalnych tokenów, żeby ją maskować.
- Lekcja o jasnym motywie (`context/foundation/lessons.md`): każdy nowy token dostaje wartość w `:root` i w `.dark`. Dotyczy planu tylko wtedy, gdy zostanie dodany token.

### Komponenty

- `ui/button` wariant `default` ma rozmiar `h-9` (`button.tsx:29`); obecny `SubmitButton` ma wysokość z `py-2`. Po przejściu na `<Button className="w-full">` wysokość jest zbliżona, do porównania na zrzucie.
- `ui/button` ma `disabled:opacity-50` i `disabled:pointer-events-none` (`button.tsx:8`); `SubmitButton` już ustawia `disabled={pending}` (`SubmitButton.tsx:17`), więc wygląd disabled zadziała po usunięciu nadpisań.
- `ui/label` bazuje na Radix i ma `flex items-center gap-2` (`label.tsx:10`), a obecny label to `mb-1 block`; odstęp `mb-1` trzeba zachować w `className`.
- `ServerError.tsx` jest już na tokenach i jest w `CLEAN_PATHS` (`scripts/check-ui-tokens.mjs:18`); to wzorzec (`text-destructive`, `border-destructive/30`).

### Konsumenci

- Sprawdzony zbiór: grep po `src` (`.tsx`, `.astro`) znajduje importy tych trzech komponentów tylko w 4 formularzach w `src/components/auth`. Zmiana propsów (`id`, `name`, `label`, `type`, `value`, `onChange`, `placeholder`, `error`, `hint`, `icon`, `endContent`) wymagałaby edycji `*Form.tsx`, więc API powinno zostać bez zmian.
- Ikona w polu jest pozycjonowana `absolute left-3`, a input ma `pl-10` (`FormField.tsx:6,42`). `ui/input` ma `px-3`, więc `pl-10` trzeba przekazać przez `className` (`cn`/tailwind-merge rozstrzyga konflikt).

### Brama i dowody

- `npm run check:ui` skanuje `CLEAN_PATHS` (`check-ui-tokens.mjs:11-21`); trzy pliki dopisujemy w ostatniej fazie.
- `src/pages/dev` zawiera tylko `dashboard-states.astro`, a `src/components/dev` tylko `DisabledSelectDemo.tsx`. Stanów formularza auth (error, disabled, loading) nie ma tam wśród zbadanych plików. Loading z `useFormStatus` trudno wywołać na realnej stronie, więc demo stanów na stronie dev jest uzasadnione. CLAUDE.md każe rozszerzać tę stronę, nie budować drugiej.

## Code References

- `src/components/auth/FormField.tsx:6` - `inputBase` z klasami palety
- `src/components/auth/FormField.tsx:37,41,53,59` - label, ikona, ring, błąd
- `src/components/auth/SubmitButton.tsx:18,22` - nadpisanie Button, spinner
- `src/components/auth/PasswordToggle.tsx:13` - brak focus-visible
- `src/components/ui/input.tsx:10-13` - tokenowy input z `aria-invalid`
- `src/components/ui/button.tsx:15` - `bg-primary hover:bg-primary-hover`
- `src/styles/global.css:15-27,68-80` - wartości tokenów
- `scripts/check-ui-tokens.mjs:11-21` - `CLEAN_PATHS`

## Architecture Insights

Kontrakt jest już zbudowany; te trzy komponenty to klasy sprzed tokenizacji. Poprawka to podmiana na `ui/*` i usunięcie klas palety, a nie nowe tokeny.

## Historical Context (from prior changes)

- `context/archive/2026-10-15-dashboard-design-tokens/` - wprowadził tokeny i `tokens.md`; ten sam wzorzec migracji.
- `context/archive/2026-10-16-ui-home-page/` - ostatnia migracja widoku; stąd lekcja o sprawdzaniu klas responsywnych w przeglądarce.

## Related Research

Brak innych aktywnych badań w `context/changes/`.

## Open Questions

1. Czy `dark:bg-input/30` wystarczy wizualnie względem `bg-white/10`? Rozstrzygnąć na zrzucie desktop + 390 px.
2. Jak umieścić demo stanów: nowa sekcja w `/dev/dashboard-states` czy osobny plik w `src/components/dev` osadzony na tej stronie?
3. Czy `hint` (ReactNode pod polem) dostanie `id` do `aria-describedby`? Nie sprawdzałem, jak formularze używają `hint`.
