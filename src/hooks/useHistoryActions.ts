import { useState } from "react";
import { monthParam } from "@/lib/dates";
import type { HistoryParams } from "@/lib/history-params";
import type { ApiError, EntryOkResponse, HistoryEntry, HistoryResponse, MonthSummary } from "@/types";

const CONNECTION_ERROR = "Brak połączenia. Spróbuj ponownie.";
const UNEXPECTED_ERROR = "Nie udało się zapisać. Spróbuj ponownie.";
const NOT_FOUND = 404;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function isEntry(value: unknown): value is HistoryEntry {
  return (
    isRecord(value) &&
    typeof value.id === "string" &&
    (value.kind === "expense" || value.kind === "income") &&
    typeof value.amountMinor === "number" &&
    typeof value.date === "string" &&
    typeof value.label === "string" &&
    (value.categoryId === null || typeof value.categoryId === "string") &&
    typeof value.categoryArchived === "boolean" &&
    (value.description === null || typeof value.description === "string") &&
    typeof value.recurring === "boolean" &&
    typeof value.planned === "boolean"
  );
}

function isSummary(value: unknown): value is MonthSummary {
  return (
    isRecord(value) &&
    typeof value.incomeTotal === "number" &&
    typeof value.expenseTotal === "number" &&
    typeof value.left === "number"
  );
}

function isHistory(value: unknown): value is HistoryResponse {
  return (
    isRecord(value) &&
    (value.entries === null || (Array.isArray(value.entries) && value.entries.every(isEntry))) &&
    (value.summary === null || isSummary(value.summary)) &&
    typeof value.truncated === "boolean"
  );
}

function isEntryOk(value: unknown): value is EntryOkResponse {
  return isRecord(value) && value.ok === true;
}

function isApiError(value: unknown): value is ApiError {
  return isRecord(value) && typeof value.error === "string";
}

/**
 * Keeps the history list in state. After a change (`remove`, or an edit made in the sheet followed by `refresh`) the
 * list is read again from /api/history with the page's own filters; when that read fails, or the entry is gone (404,
 * e.g. deleted in another tab), the page reloads. While a request runs `pending` is true: callers disable their
 * buttons with it.
 */
export function useHistoryActions(initial: HistoryResponse, params: HistoryParams) {
  const [entries, setEntries] = useState<HistoryEntry[]>(initial.entries ?? []);
  const [summary, setSummary] = useState(initial.summary);
  const [truncated, setTruncated] = useState(initial.truncated);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<{ target: string; message: string } | null>(null);

  /** Resolves to the fresh list (null when the page is reloading instead). */
  async function refresh(): Promise<HistoryEntry[] | null> {
    const query = new URLSearchParams({ typ: params.typ, month: monthParam(params.month) });
    if (params.categoryId) query.set("kategoria", params.categoryId);
    setPending(true);
    try {
      const response = await fetch(`/api/history?${query.toString()}`);
      const body: unknown = await response.json().catch(() => null);
      if (response.ok && isHistory(body) && body.entries !== null) {
        setEntries(body.entries);
        setSummary(body.summary);
        setTruncated(body.truncated);
        return body.entries;
      }
    } catch {
      // Falls through to the reload below.
    } finally {
      setPending(false);
    }
    window.location.reload();
    return null;
  }

  /** Resolves to true when the entry was deleted. */
  async function remove(entry: HistoryEntry): Promise<boolean> {
    setPending(true);
    setError(null);
    try {
      const response = await fetch(`/api/${entry.kind === "expense" ? "expenses" : "incomes"}/${entry.id}`, {
        method: "DELETE",
      });
      const body: unknown = await response.json().catch(() => null);

      if (response.status === NOT_FOUND) {
        window.location.reload();
        return false;
      }
      if (response.ok && isEntryOk(body)) {
        await refresh();
        return true;
      }
      setError({ target: entry.id, message: isApiError(body) ? body.error : UNEXPECTED_ERROR });
      return false;
    } catch {
      setError({ target: entry.id, message: CONNECTION_ERROR });
      return false;
    } finally {
      setPending(false);
    }
  }

  const clearError = () => {
    setError(null);
  };

  return { entries, summary, truncated, pending, error, clearError, remove, refresh };
}
