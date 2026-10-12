import { SAVE_FAILED, json } from "@/lib/http";
import type { RecurringIncomeResult } from "@/lib/services/recurring-incomes";

const UNIQUE_VIOLATION = "23505";
const INVALID_PARAMETER = "22023";
const NO_DATA_FOUND = "P0002";

/** Maps a recurring-income service result to the HTTP response shared by all its routes. */
export function recurringIncomeResponse(result: RecurringIncomeResult): Response {
  if (result.ok) return json({ items: result.items });

  switch (result.code) {
    case UNIQUE_VIOLATION:
      return json({ error: "Taka cykliczna pozycja już istnieje" }, 400);
    case INVALID_PARAMETER:
      // zod already checks the 1-24 range, so the database only raises this when the horizon would pass 24 months.
      return json({ error: "Horyzont może obejmować najwyżej 24 miesiące (licząc od bieżącego)" }, 400);
    case NO_DATA_FOUND:
      return json({ error: "Nie znaleziono cyklicznego przychodu" }, 404);
    default:
      return json({ error: SAVE_FAILED }, 500);
  }
}
