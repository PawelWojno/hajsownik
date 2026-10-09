import type { ApiError, CategoryListResponse, SavedEntryResponse } from "@/types";

export function json(body: SavedEntryResponse | CategoryListResponse | ApiError, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });
}

export const UNAUTHORIZED = "Sesja wygasła. Zaloguj się ponownie.";
export const INVALID_REQUEST = "Nieprawidłowe dane formularza.";
export const SAVE_FAILED = "Nie udało się zapisać. Spróbuj ponownie.";

/** Parses the JSON body of a request; `undefined` means it was not valid JSON. */
export async function readJson(request: Request): Promise<unknown> {
  try {
    return await request.json();
  } catch {
    return undefined;
  }
}

export const invalidRequest = () => json({ error: INVALID_REQUEST }, 400);
