import { useState } from "react";
import type { ApiError, MonthSummary, SavedEntryResponse } from "@/types";

type EntryKind = "expenses" | "incomes";

export type SubmitResult = { ok: true; data: SavedEntryResponse } | { ok: false; error: string };

const CONNECTION_ERROR = "Brak połączenia. Spróbuj ponownie.";
const UNEXPECTED_ERROR = "Nie udało się zapisać. Spróbuj ponownie.";

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function isSummary(value: unknown): value is MonthSummary {
  return (
    isRecord(value) &&
    typeof value.incomeTotal === "number" &&
    typeof value.expenseTotal === "number" &&
    typeof value.left === "number"
  );
}

function isSavedEntry(value: unknown): value is SavedEntryResponse {
  return isRecord(value) && isSummary(value.summary) && typeof value.inCurrentMonth === "boolean";
}

function isApiError(value: unknown): value is ApiError {
  return isRecord(value) && typeof value.error === "string";
}

/** POSTs an entry to /api/expenses or /api/incomes and reports the outcome; exposes `pending` to block double submits. */
export function useEntrySubmit() {
  const [pending, setPending] = useState(false);

  async function submit(kind: EntryKind, payload: Record<string, string>): Promise<SubmitResult> {
    setPending(true);
    try {
      const response = await fetch(`/api/${kind}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const body: unknown = await response.json().catch(() => null);

      if (response.ok && isSavedEntry(body)) return { ok: true, data: body };
      return { ok: false, error: isApiError(body) ? body.error : UNEXPECTED_ERROR };
    } catch {
      return { ok: false, error: CONNECTION_ERROR };
    } finally {
      setPending(false);
    }
  }

  return { submit, pending };
}
