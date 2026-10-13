import { SAVE_FAILED, json } from "@/lib/http";
import { NOT_FOUND } from "@/lib/services/categories";
import { ARCHIVED_CATEGORY, type EntryResult } from "@/lib/services/entries";

const FOREIGN_KEY_VIOLATION = "23503";
const INVALID_PARAMETER = "22023";

/** Maps an entry edit / delete result to the HTTP response shared by the expense and income routes. */
export function entryResponse(result: EntryResult): Response {
  if (result.ok) return json({ ok: true });

  switch (result.code) {
    case NOT_FOUND:
      return json({ error: "Nie znaleziono wpisu" }, 404);
    case INVALID_PARAMETER:
      // Raised by the database trigger: an entry from a cycle keeps its date and category.
      return json({ error: "Wpis z cyklu: zmienisz tylko kwotę i opis" }, 400);
    case ARCHIVED_CATEGORY:
      return json({ error: "Ta kategoria jest zarchiwizowana" }, 400);
    case FOREIGN_KEY_VIOLATION:
      return json({ error: "Wybierz kategorię z listy" }, 400);
    default:
      return json({ error: SAVE_FAILED }, 500);
  }
}
