import type { SupabaseClient } from "@supabase/supabase-js";
import { z } from "zod";
import { INCOME_SOURCES, type RecurringIncome } from "@/types";

const recurringIncomeRows = z.array(
  z.object({
    id: z.string(),
    source: z.enum(INCOME_SOURCES),
    amount_minor: z.number(),
    day_of_month: z.number(),
    start_month: z.string(),
    end_month: z.string(),
    months_left: z.number(),
    remind: z.boolean(),
  }),
);

/** Outcome of a mutation. `items: null` = the change is saved but the fresh list could not be read. */
export type RecurringIncomeResult = { ok: true; items: RecurringIncome[] | null } | { ok: false; code: string };

export interface NewRecurringIncome {
  source: string;
  amountMinor: number;
  dayOfMonth: number;
  months: number;
}

/** Active and lapsed recurring incomes of the caller's household (RLS), newest first. */
export async function listRecurringIncomes(supabase: SupabaseClient): Promise<RecurringIncome[]> {
  const result = await supabase.rpc("list_recurring_incomes");
  if (result.error) throw new Error(result.error.message);

  // An untyped rpc answers `any`; the zod schema is what makes the rows trustworthy.
  const data: unknown = result.data;
  return recurringIncomeRows.parse(data).map((row) => ({
    id: row.id,
    source: row.source,
    amountMinor: row.amount_minor,
    dayOfMonth: row.day_of_month,
    startMonth: row.start_month,
    endMonth: row.end_month,
    monthsLeft: row.months_left,
    remind: row.remind,
  }));
}

/** The write is already committed here, so a failed read must not look like a failed write (it would invite a retry). */
async function succeeded(supabase: SupabaseClient): Promise<RecurringIncomeResult> {
  try {
    return { ok: true, items: await listRecurringIncomes(supabase) };
  } catch {
    return { ok: true, items: null };
  }
}

function failed(error: { code?: string }): RecurringIncomeResult {
  return { ok: false, code: error.code ?? "" };
}

/** Each operation is one database function = one transaction; a missing or foreign id raises P0002. */
export async function createRecurringIncome(
  supabase: SupabaseClient,
  input: NewRecurringIncome,
): Promise<RecurringIncomeResult> {
  const { error } = await supabase.rpc("create_recurring_income", {
    p_source: input.source,
    p_amount_minor: input.amountMinor,
    p_day: input.dayOfMonth,
    p_months: input.months,
  });
  return error ? failed(error) : succeeded(supabase);
}

export async function updateRecurringIncomeAmount(
  supabase: SupabaseClient,
  id: string,
  amountMinor: number,
): Promise<RecurringIncomeResult> {
  const { error } = await supabase.rpc("update_recurring_income_amount", { p_id: id, p_amount_minor: amountMinor });
  return error ? failed(error) : succeeded(supabase);
}

export async function extendRecurringIncome(
  supabase: SupabaseClient,
  id: string,
  months: number,
): Promise<RecurringIncomeResult> {
  const { error } = await supabase.rpc("extend_recurring_income", { p_id: id, p_months: months });
  return error ? failed(error) : succeeded(supabase);
}

export async function stopRecurringIncome(supabase: SupabaseClient, id: string): Promise<RecurringIncomeResult> {
  const { error } = await supabase.rpc("stop_recurring_income", { p_id: id });
  return error ? failed(error) : succeeded(supabase);
}

export async function dismissRecurringIncomeReminder(
  supabase: SupabaseClient,
  id: string,
): Promise<RecurringIncomeResult> {
  const { error } = await supabase.rpc("dismiss_recurring_income_reminder", { p_id: id });
  return error ? failed(error) : succeeded(supabase);
}
