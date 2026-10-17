---
change_id: ui-auth-shared-components
title: Wspólne komponenty auth na tokenach i komponentach ui
status: implemented
created: 2026-10-17
updated: 2026-10-17
archived_at: null
---

## Notes

- **Widok:** wspólne komponenty auth: `src/components/auth/FormField.tsx`, `SubmitButton.tsx`, `PasswordToggle.tsx`.
- **Źródło tokenów:** `src/styles/global.css`.
- **Wariant kontraktu:** istniejący system projektowy (Tailwind 4 + shadcn/ui). Rozszerzamy go, bez drugiego `shadcn init`. Wzorzec: `ServerError.tsx` (już na tokenach).
- **Poza zakresem:** strony `src/pages/auth/*` i `*Form.tsx`.
- **Ostatnia faza:** dopisać te trzy pliki do `CLEAN_PATHS` w `scripts/check-ui-tokens.mjs`.

### Wstępne zarzuty (skan: 8 trafionych linii)

1. Brakujące tokeny, `FormField.tsx:6,37,41,53,59`: `purple-400`, `red-400`, `red-300`, `blue-100/80`, `white/*` zamiast `ring`, `destructive`, `muted-foreground`, `input`, `border`.
2. Brakujący współdzielony komponent, `FormField.tsx:6,49-54`: ręczny `<input>` i `<label>` zamiast `ui/input.tsx` i `ui/label.tsx`.
3. Brakujący współdzielony komponent, `SubmitButton.tsx:18,22`: `Button` nadpisany `bg-purple-600 hover:bg-purple-500` zamiast `bg-primary` i `primary-hover`; spinner na `border-white/30`.
4. Brakujące tokeny i stan, `PasswordToggle.tsx:13`: brak `focus-visible`, kolory `white/40` i `white/70`.
5. Do sprawdzenia w research: brak `aria-invalid` i `aria-describedby` w `FormField` (błąd tylko kolorem i tekstem bez powiązania z polem).
