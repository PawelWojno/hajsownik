import { SAVE_FAILED, json } from "@/lib/http";
import { NOT_FOUND, type CategoryResult } from "@/lib/services/categories";

const UNIQUE_VIOLATION = "23505";
const FOREIGN_KEY_VIOLATION = "23503";
const INVALID_PARAMETER = "22023";

/** Maps a category service result to the HTTP response shared by all category routes. */
export function categoryResponse(result: CategoryResult): Response {
  if (result.ok) return json({ categories: result.categories });

  switch (result.code) {
    case UNIQUE_VIOLATION:
      return json({ error: "Kategoria o tej nazwie już istnieje" }, 400);
    case FOREIGN_KEY_VIOLATION:
      return json({ error: "Ta kategoria ma wydatki. Zarchiwizuj ją zamiast usuwać." }, 400);
    case INVALID_PARAMETER:
      return json({ error: "Lista kategorii zmieniła się. Odśwież stronę." }, 409);
    case NOT_FOUND:
      return json({ error: "Nie znaleziono kategorii" }, 404);
    default:
      return json({ error: SAVE_FAILED }, 500);
  }
}
