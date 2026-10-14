---
change_id: expense-history-and-edits
title: Expense history and edits
status: archived
created: 2026-10-12
updated: 2026-10-14
archived_at: 2026-10-14T16:32:15Z
---

## Notes

<!-- Free-form notes for this change: links, ad-hoc context, decisions that don't belong in research/frame/plan. -->

- Faza 4: dodać `autoComplete="off"` do pola opisu w `EntrySheet.tsx` (przeglądarka podpowiada poprzednie opisy; decyzja 2026-10-13).
- Do rozważenia przy fazie 5/redakcji tekstów: opis wpisu cyklicznego jest tracony po zmianie kwoty cyklu; opis w definicji cyklu planowany w przyszłości.
- ~~Przy aktywnym filtrze kategorii zmiana kategorii wpisu usuwa go z listy bez komunikatu.~~ Załatwione w impl-review (F7): ogólne „Przeniesiono”, gdy edytowany wpis zniknął z listy.
- Do redakcji tekstów: komunikat 22023 („Wpis z cyklu: zmienisz tylko kwotę i opis”) wspomina opis także przy przychodzie, który ma edytowalną tylko kwotę. Z UI nieosiągalny (formularz cyklu wysyła tylko kwotę/opis). Poprawka: rodzaj wpisu w `entryResponse` i obu trasach `[id]`.
