---
change_id: expense-history-and-edits
title: Expense history and edits
status: implementing
created: 2026-10-12
updated: 2026-10-13
archived_at: null
---

## Notes

<!-- Free-form notes for this change: links, ad-hoc context, decisions that don't belong in research/frame/plan. -->

- Faza 4: dodać `autoComplete="off"` do pola opisu w `EntrySheet.tsx` (przeglądarka podpowiada poprzednie opisy; decyzja 2026-10-13).
- Do rozważenia przy fazie 5/redakcji tekstów: opis wpisu cyklicznego jest tracony po zmianie kwoty cyklu; opis w definicji cyklu planowany w przyszłości.
- Do poprawy przy redakcji tekstów/komunikatów: przy aktywnym filtrze kategorii zmiana kategorii wpisu usuwa go z listy bez komunikatu (jest tylko „Przeniesiono: miesiąc” dla zmiany miesiąca).
