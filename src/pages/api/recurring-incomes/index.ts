import type { APIRoute } from "astro";
import { z } from "zod";
import { INVALID_REQUEST, SAVE_FAILED, UNAUTHORIZED, invalidRequest, json, readJson } from "@/lib/http";
import { recurringIncomeResponse } from "@/lib/recurring-income-http";
import { createRecurringIncome } from "@/lib/services/recurring-incomes";
import { createClient } from "@/lib/supabase";
import { amountField, dayOfMonthField, monthsField } from "@/lib/validation";
import { INCOME_SOURCES } from "@/types";

export const prerender = false;

// No date field: the database computes every entry's date from the chosen day and the current Warsaw month.
const createSchema = z.object(
  {
    source: z.enum(INCOME_SOURCES, "Wybierz źródło przychodu"),
    amount: amountField,
    dayOfMonth: dayOfMonthField,
    months: monthsField,
  },
  INVALID_REQUEST,
);

export const POST: APIRoute = async (context) => {
  if (!context.locals.user) return json({ error: UNAUTHORIZED }, 401);

  const supabase = createClient(context.request.headers, context.cookies);
  if (!supabase) return json({ error: SAVE_FAILED }, 500);

  const body = await readJson(context.request);
  if (body === undefined) return invalidRequest();

  const parsed = createSchema.safeParse(body);
  if (!parsed.success) return json({ error: parsed.error.issues[0].message }, 400);

  const { source, amount, dayOfMonth, months } = parsed.data;
  return recurringIncomeResponse(
    await createRecurringIncome(supabase, { source, amountMinor: amount, dayOfMonth, months }),
  );
};
