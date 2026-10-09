import type { ApiError, CategoryListResponse, SavedEntryResponse } from "@/types";

export function json(body: SavedEntryResponse | CategoryListResponse | ApiError, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });
}

export const UNAUTHORIZED = "Sesja wygasła. Zaloguj się ponownie.";
export const INVALID_REQUEST = "Nieprawidłowe dane formularza.";
export const SAVE_FAILED = "Nie udało się zapisać. Spróbuj ponownie.";
