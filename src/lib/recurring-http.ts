import { SAVE_FAILED, json } from "@/lib/http";
import type { RecurringResult } from "@/lib/services/recurring-expenses";

const UNIQUE_VIOLATION = "23505";
const FOREIGN_KEY_VIOLATION = "23503";
const INVALID_PARAMETER = "22023";
const NO_DATA_FOUND = "P0002";

/** Maps a recurring-expense service result to the HTTP response shared by all its routes. */
export function recurringResponse(result: RecurringResult): Response {
  if (result.ok) return json({ items: result.items });

  switch (result.code) {
    case UNIQUE_VIOLATION:
      return json({ error: "Taka cykliczna pozycja już istnieje" }, 400);
    case FOREIGN_KEY_VIOLATION:
      return json({ error: "Wybierz kategorię z listy" }, 400);
    case INVALID_PARAMETER:
      // zod already checks the 1-24 range, so the database only raises this when the horizon would pass 24 months.
      return json({ error: "Horyzont może obejmować najwyżej 24 miesiące (licząc od bieżącego)" }, 400);
    case NO_DATA_FOUND:
      return json({ error: "Nie znaleziono cyklicznego wydatku" }, 404);
    default:
      return json({ error: SAVE_FAILED }, 500);
  }
}
