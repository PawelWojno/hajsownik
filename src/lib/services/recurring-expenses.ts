import type { SupabaseClient } from "@supabase/supabase-js";
import { z } from "zod";
import type { RecurringExpense } from "@/types";

const recurringRows = z.array(
  z.object({
    id: z.string(),
    category_id: z.string(),
    category_name: z.string(),
    category_archived: z.boolean(),
    amount_minor: z.number(),
    day_of_month: z.number(),
    start_month: z.string(),
    end_month: z.string(),
    months_left: z.number(),
    remind: z.boolean(),
  }),
);

/** Outcome of a mutation. `items: null` = the change is saved but the fresh list could not be read. */
export type RecurringResult = { ok: true; items: RecurringExpense[] | null } | { ok: false; code: string };

export interface NewRecurringExpense {
  categoryId: string;
  amountMinor: number;
  dayOfMonth: number;
  months: number;
}

/** Active and lapsed recurring expenses of the caller's household (RLS), newest first. */
export async function listRecurringExpenses(supabase: SupabaseClient): Promise<RecurringExpense[]> {
  const result = await supabase.rpc("list_recurring_expenses");
  if (result.error) throw new Error(result.error.message);

  // An untyped rpc answers `any`; the zod schema is what makes the rows trustworthy.
  const data: unknown = result.data;
  return recurringRows.parse(data).map((row) => ({
    id: row.id,
    categoryId: row.category_id,
    categoryName: row.category_name,
    categoryArchived: row.category_archived,
    amountMinor: row.amount_minor,
    dayOfMonth: row.day_of_month,
    startMonth: row.start_month,
    endMonth: row.end_month,
    monthsLeft: row.months_left,
    remind: row.remind,
  }));
}

/** The write is already committed here, so a failed read must not look like a failed write (it would invite a retry). */
async function succeeded(supabase: SupabaseClient): Promise<RecurringResult> {
  try {
    return { ok: true, items: await listRecurringExpenses(supabase) };
  } catch {
    return { ok: true, items: null };
  }
}

function failed(error: { code?: string }): RecurringResult {
  return { ok: false, code: error.code ?? "" };
}

/** Each operation is one database function = one transaction; a missing or foreign id raises P0002. */
export async function createRecurringExpense(
  supabase: SupabaseClient,
  input: NewRecurringExpense,
): Promise<RecurringResult> {
  const { error } = await supabase.rpc("create_recurring_expense", {
    p_category_id: input.categoryId,
    p_amount_minor: input.amountMinor,
    p_day: input.dayOfMonth,
    p_months: input.months,
  });
  return error ? failed(error) : succeeded(supabase);
}

export async function updateRecurringAmount(
  supabase: SupabaseClient,
  id: string,
  amountMinor: number,
): Promise<RecurringResult> {
  const { error } = await supabase.rpc("update_recurring_expense_amount", { p_id: id, p_amount_minor: amountMinor });
  return error ? failed(error) : succeeded(supabase);
}

export async function extendRecurring(supabase: SupabaseClient, id: string, months: number): Promise<RecurringResult> {
  const { error } = await supabase.rpc("extend_recurring_expense", { p_id: id, p_months: months });
  return error ? failed(error) : succeeded(supabase);
}

export async function stopRecurring(supabase: SupabaseClient, id: string): Promise<RecurringResult> {
  const { error } = await supabase.rpc("stop_recurring_expense", { p_id: id });
  return error ? failed(error) : succeeded(supabase);
}

export async function dismissReminder(supabase: SupabaseClient, id: string): Promise<RecurringResult> {
  const { error } = await supabase.rpc("dismiss_recurring_reminder", { p_id: id });
  return error ? failed(error) : succeeded(supabase);
}
