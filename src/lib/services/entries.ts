import type { SupabaseClient } from "@supabase/supabase-js";
import { z } from "zod";
import { nextMonthStart, todayInWarsaw } from "@/lib/dates";
import { listCategories, NOT_FOUND } from "@/lib/services/categories";
import { getMonthSummary } from "@/lib/services/month";
import type { HistoryEntry, HistoryResponse, ManagedCategory } from "@/types";

export const HISTORY_LIMIT = 200;

/** Pseudo error code: the new category is archived and differs from the one the entry already has. */
export const ARCHIVED_CATEGORY = "archived_category";

export type EntryKind = HistoryEntry["kind"];

export interface HistoryQuery {
  kind: EntryKind;
  /** First day of the month, YYYY-MM-01. */
  month: string;
  /** Expenses only. */
  categoryId?: string;
}

export type EntryResult = { ok: true } | { ok: false; code: string };

const expenseRows = z.array(
  z.object({
    id: z.string(),
    category_id: z.string(),
    amount_minor: z.number(),
    spent_on: z.string(),
    description: z.string().nullable(),
    recurring_expense_id: z.string().nullable(),
  }),
);

const incomeRows = z.array(
  z.object({
    id: z.string(),
    source: z.string(),
    amount_minor: z.number(),
    received_on: z.string(),
    recurring_income_id: z.string().nullable(),
  }),
);

/** The one place where the text of a row is decided: the category name for an expense, the source for an income. */
function entryLabel(entry: { categoryId: string } | { source: string }, categories: Map<string, ManagedCategory>) {
  return "source" in entry ? entry.source : (categories.get(entry.categoryId)?.name ?? "");
}

async function readEntries(
  supabase: SupabaseClient,
  query: HistoryQuery,
  categories: Map<string, ManagedCategory>,
): Promise<HistoryEntry[]> {
  const today = todayInWarsaw();
  const end = nextMonthStart(query.month);

  if (query.kind === "income") {
    const { data, error } = await supabase
      .from("incomes")
      .select("id, source, amount_minor, received_on, recurring_income_id")
      .gte("received_on", query.month)
      .lt("received_on", end)
      .order("received_on", { ascending: false })
      .order("created_at", { ascending: false })
      .order("id", { ascending: false })
      .limit(HISTORY_LIMIT + 1);
    if (error) throw new Error(error.message);

    return incomeRows.parse(data).map((row) => ({
      id: row.id,
      kind: "income",
      amountMinor: row.amount_minor,
      date: row.received_on,
      label: entryLabel({ source: row.source }, categories),
      categoryId: null,
      categoryArchived: false,
      description: null,
      recurring: row.recurring_income_id !== null,
      planned: row.received_on > today,
    }));
  }

  let request = supabase
    .from("expenses")
    .select("id, category_id, amount_minor, spent_on, description, recurring_expense_id")
    .gte("spent_on", query.month)
    .lt("spent_on", end);
  if (query.categoryId) request = request.eq("category_id", query.categoryId);
  const { data, error } = await request
    .order("spent_on", { ascending: false })
    .order("created_at", { ascending: false })
    .order("id", { ascending: false })
    .limit(HISTORY_LIMIT + 1);
  if (error) throw new Error(error.message);

  return expenseRows.parse(data).map((row) => ({
    id: row.id,
    kind: "expense",
    amountMinor: row.amount_minor,
    date: row.spent_on,
    label: entryLabel({ categoryId: row.category_id }, categories),
    categoryId: row.category_id,
    categoryArchived: categories.get(row.category_id)?.archived ?? false,
    description: row.description,
    recurring: row.recurring_expense_id !== null,
    planned: row.spent_on > today,
  }));
}

/**
 * Entries of one month, newest first, plus the sums of that month. A failed list read gives `entries: null` (the page
 * then shows an error or reloads); a failed sums read only gives `summary: null`.
 */
export async function listHistory(supabase: SupabaseClient, query: HistoryQuery): Promise<HistoryResponse> {
  const [entries, summary] = await Promise.all([
    (async () => {
      const categories = new Map((await listCategories(supabase)).map((category) => [category.id, category]));
      return await readEntries(supabase, query, categories);
    })().catch(() => null),
    getMonthSummary(supabase, query.month).catch(() => null),
  ]);
  if (entries === null) return { entries: null, summary, truncated: false };
  return { entries: entries.slice(0, HISTORY_LIMIT), summary, truncated: entries.length > HISTORY_LIMIT };
}

export interface ExpensePatch {
  amountMinor: number;
  categoryId?: string;
  date?: string;
  /** Empty string clears the description. */
  description?: string;
}

export interface IncomePatch {
  amountMinor: number;
  source?: string;
  date?: string;
}

function failed(error: { code?: string }): EntryResult {
  return { ok: false, code: error.code ?? "" };
}

/** RLS turns a foreign or missing id into "0 rows changed" instead of an error, so the row count is checked. */
export async function updateExpense(supabase: SupabaseClient, id: string, patch: ExpensePatch): Promise<EntryResult> {
  if (patch.categoryId !== undefined) {
    const { data: current, error } = await supabase.from("expenses").select("category_id").eq("id", id).maybeSingle();
    if (error) return failed(error);
    if (!current) return { ok: false, code: NOT_FOUND };

    // Keeping the current (possibly archived) category is fine; moving to another archived one is not.
    if (current.category_id !== patch.categoryId) {
      const { data: target, error: targetError } = await supabase
        .from("categories")
        .select("archived_at")
        .eq("id", patch.categoryId)
        .maybeSingle();
      if (targetError) return failed(targetError);
      if (target?.archived_at) return { ok: false, code: ARCHIVED_CATEGORY };
    }
  }

  const { data, error } = await supabase
    .from("expenses")
    .update({
      amount_minor: patch.amountMinor,
      ...(patch.categoryId !== undefined && { category_id: patch.categoryId }),
      ...(patch.date !== undefined && { spent_on: patch.date }),
      ...(patch.description !== undefined && { description: patch.description === "" ? null : patch.description }),
    })
    .eq("id", id)
    .select("id");
  if (error) return failed(error);
  return data.length === 0 ? { ok: false, code: NOT_FOUND } : { ok: true };
}

export async function updateIncome(supabase: SupabaseClient, id: string, patch: IncomePatch): Promise<EntryResult> {
  const { data, error } = await supabase
    .from("incomes")
    .update({
      amount_minor: patch.amountMinor,
      ...(patch.source !== undefined && { source: patch.source }),
      ...(patch.date !== undefined && { received_on: patch.date }),
    })
    .eq("id", id)
    .select("id");
  if (error) return failed(error);
  return data.length === 0 ? { ok: false, code: NOT_FOUND } : { ok: true };
}

export async function deleteEntry(supabase: SupabaseClient, kind: EntryKind, id: string): Promise<EntryResult> {
  const { data, error } = await supabase
    .from(kind === "expense" ? "expenses" : "incomes")
    .delete()
    .eq("id", id)
    .select("id");
  if (error) return failed(error);
  return data.length === 0 ? { ok: false, code: NOT_FOUND } : { ok: true };
}
