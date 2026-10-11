import type { APIRoute } from "astro";
import { z } from "zod";
import { INVALID_REQUEST, SAVE_FAILED, UNAUTHORIZED, invalidRequest, json, readJson } from "@/lib/http";
import { recurringResponse } from "@/lib/recurring-http";
import { createRecurringExpense } from "@/lib/services/recurring-expenses";
import { createClient } from "@/lib/supabase";
import { amountField, dayOfMonthField, monthsField } from "@/lib/validation";

export const prerender = false;

// No date field: the database computes every entry's date from the chosen day and the current Warsaw month.
const createSchema = z.object(
  {
    categoryId: z.uuid("Wybierz kategorię"),
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

  const { categoryId, amount, dayOfMonth, months } = parsed.data;
  return recurringResponse(
    await createRecurringExpense(supabase, { categoryId, amountMinor: amount, dayOfMonth, months }),
  );
};
