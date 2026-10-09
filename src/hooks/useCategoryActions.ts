import { useState } from "react";
import type { ApiError, CategoryListResponse, ManagedCategory } from "@/types";

/** Error target for the add form; any other target is the id of the category row the error belongs to. */
export const ADD_TARGET = "add";

const CONNECTION_ERROR = "Brak połączenia. Spróbuj ponownie.";
const UNEXPECTED_ERROR = "Nie udało się zapisać. Spróbuj ponownie.";
const CONFLICT = 409;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function isCategory(value: unknown): value is ManagedCategory {
  return (
    isRecord(value) &&
    typeof value.id === "string" &&
    typeof value.name === "string" &&
    typeof value.archived === "boolean"
  );
}

function isCategoryList(value: unknown): value is CategoryListResponse {
  return (
    isRecord(value) &&
    (value.categories === null || (Array.isArray(value.categories) && value.categories.every(isCategory)))
  );
}

function isApiError(value: unknown): value is ApiError {
  return isRecord(value) && typeof value.error === "string";
}

/**
 * Calls the category API and keeps the list in state. Every mutation answers with the fresh list, so the state is
 * replaced in one go; a missing list (saved but unreadable) or a 409 (stale list) reloads the page instead.
 */
export function useCategoryActions(initial: ManagedCategory[]) {
  const [categories, setCategories] = useState(initial);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<{ target: string; message: string } | null>(null);

  /** Resolves to true when the change was saved, so the caller can close its inline form. */
  async function call(target: string, url: string, method: string, payload?: unknown): Promise<boolean> {
    setPending(true);
    setError(null);
    try {
      const response = await fetch(url, {
        method,
        headers: payload === undefined ? undefined : { "Content-Type": "application/json" },
        body: payload === undefined ? undefined : JSON.stringify(payload),
      });
      const body: unknown = await response.json().catch(() => null);

      if (response.status === CONFLICT) {
        window.location.reload();
        return false;
      }
      if (response.ok && isCategoryList(body)) {
        if (body.categories === null) {
          window.location.reload();
          return true;
        }
        setCategories(body.categories);
        return true;
      }
      setError({ target, message: isApiError(body) ? body.error : UNEXPECTED_ERROR });
      return false;
    } catch {
      setError({ target, message: CONNECTION_ERROR });
      return false;
    } finally {
      setPending(false);
    }
  }

  const add = (name: string) => call(ADD_TARGET, "/api/categories", "POST", { name });
  const rename = (id: string, name: string) => call(id, `/api/categories/${id}`, "PATCH", { name });
  const setArchived = (id: string, archived: boolean) => call(id, `/api/categories/${id}`, "PATCH", { archived });
  const remove = (id: string) => call(id, `/api/categories/${id}`, "DELETE");

  /** Swaps a category with its neighbour among the active ones; the full id list (archived last) goes to the API. */
  function move(id: string, direction: -1 | 1) {
    const active = categories.filter((category) => !category.archived);
    const from = active.findIndex((category) => category.id === id);
    const to = from + direction;
    if (from === -1 || to < 0 || to >= active.length) return Promise.resolve(false);

    const reordered = [...active];
    [reordered[from], reordered[to]] = [reordered[to], reordered[from]];
    const ids = [...reordered, ...categories.filter((category) => category.archived)].map((category) => category.id);
    return call(id, "/api/categories/reorder", "POST", { ids });
  }

  const clearError = () => {
    setError(null);
  };

  return { categories, pending, error, clearError, add, rename, setArchived, remove, move };
}
