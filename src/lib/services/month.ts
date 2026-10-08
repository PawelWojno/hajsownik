import type { SupabaseClient } from "@supabase/supabase-js";
import { z } from "zod";
import { currentMonthStart, monthStartOf } from "@/lib/dates";
import type { MonthSummary, SavedEntryResponse } from "@/types";

const summaryRow = z.object({ income_total: z.number(), expense_total: z.number() });

/** Totals for the month containing `monthStart`, for the caller's household (RLS does the filtering). */
export async function getMonthSummary(supabase: SupabaseClient, monthStart: string): Promise<MonthSummary> {
  const { data, error } = await supabase.rpc("month_summary", { p_month: monthStart }).single();
  if (error) throw new Error(error.message);

  const row = summaryRow.parse(data);
  return { incomeTotal: row.income_total, expenseTotal: row.expense_total, left: row.income_total - row.expense_total };
}

/** Response body for a just-saved entry: fresh sums for the current month plus whether the entry is part of them. */
export async function buildSavedResponse(supabase: SupabaseClient, entryDate: string): Promise<SavedEntryResponse> {
  const thisMonth = currentMonthStart();
  return {
    summary: await getMonthSummary(supabase, thisMonth),
    inCurrentMonth: monthStartOf(entryDate) === thisMonth,
  };
}
