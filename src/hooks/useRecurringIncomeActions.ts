import { useState } from "react";
import type { ApiError, RecurringIncome, RecurringIncomeListResponse } from "@/types";

/** Error target for the add form; any other target is the id of the definition the error belongs to. */
export const ADD_TARGET = "add";

const CONNECTION_ERROR = "Brak połączenia. Spróbuj ponownie.";
const UNEXPECTED_ERROR = "Nie udało się zapisać. Spróbuj ponownie.";
const NOT_FOUND = 404;

export interface NewRecurringIncome {
  source: string;
  /** Raw text typed by the user ("1850,00"); the server converts it to grosze. */
  amount: string;
  dayOfMonth: number;
  months: number;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function isRecurringIncome(value: unknown): value is RecurringIncome {
  return (
    isRecord(value) &&
    typeof value.id === "string" &&
    typeof value.source === "string" &&
    typeof value.amountMinor === "number" &&
    typeof value.dayOfMonth === "number" &&
    typeof value.startMonth === "string" &&
    typeof value.endMonth === "string" &&
    typeof value.monthsLeft === "number" &&
    typeof value.remind === "boolean"
  );
}

function isRecurringIncomeList(value: unknown): value is RecurringIncomeListResponse {
  return (
    isRecord(value) && (value.items === null || (Array.isArray(value.items) && value.items.every(isRecurringIncome)))
  );
}

function isApiError(value: unknown): value is ApiError {
  return isRecord(value) && typeof value.error === "string";
}

/**
 * Calls the recurring-income API and keeps the list in state. Every mutation answers with the fresh list, so the state
 * is replaced in one go; a missing list (saved but unreadable) or a 404 (the definition was stopped elsewhere, e.g. in
 * another tab, so the list is stale) reloads the page instead.
 * While a request runs `pending` is true: callers disable their buttons with it, so a double click cannot send a
 * second "create" (see the duplicate-protection lesson in context/foundation/lessons.md).
 */
export function useRecurringIncomeActions(initial: RecurringIncome[]) {
  const [items, setItems] = useState(initial);
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

      if (response.status === NOT_FOUND) {
        window.location.reload();
        return false;
      }
      if (response.ok && isRecurringIncomeList(body)) {
        if (body.items === null) {
          window.location.reload();
          return true;
        }
        setItems(body.items);
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

  const add = (input: NewRecurringIncome) => call(ADD_TARGET, "/api/recurring-incomes", "POST", input);
  const changeAmount = (id: string, amount: string) => call(id, `/api/recurring-incomes/${id}`, "PATCH", { amount });
  const extend = (id: string, months: number) =>
    call(id, `/api/recurring-incomes/${id}`, "PATCH", { extendMonths: months });
  const dismissReminder = (id: string) => call(id, `/api/recurring-incomes/${id}`, "PATCH", { dismissReminder: true });
  const stop = (id: string) => call(id, `/api/recurring-incomes/${id}`, "DELETE");

  const clearError = () => {
    setError(null);
  };

  return { items, pending, error, clearError, add, changeAmount, extend, dismissReminder, stop };
}
