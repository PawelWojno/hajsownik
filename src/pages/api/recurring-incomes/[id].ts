import type { APIRoute } from "astro";
import { z } from "zod";
import { INVALID_REQUEST, SAVE_FAILED, UNAUTHORIZED, invalidRequest, json, readJson } from "@/lib/http";
import { recurringIncomeResponse } from "@/lib/recurring-income-http";
import {
  dismissRecurringIncomeReminder,
  extendRecurringIncome,
  stopRecurringIncome,
  updateRecurringIncomeAmount,
} from "@/lib/services/recurring-incomes";
import { createClient } from "@/lib/supabase";
import { amountField, monthsField } from "@/lib/validation";

export const prerender = false;

const idSchema = z.uuid();

// Exactly one of the three fields: a new amount, an extension, or dismissing the reminder.
const patchSchema = z
  .object(
    {
      amount: amountField.optional(),
      extendMonths: monthsField.optional(),
      dismissReminder: z.literal(true, INVALID_REQUEST).optional(),
    },
    INVALID_REQUEST,
  )
  .refine(
    (value) =>
      [value.amount, value.extendMonths, value.dismissReminder].filter((field) => field !== undefined).length === 1,
    INVALID_REQUEST,
  );

export const PATCH: APIRoute = async (context) => {
  if (!context.locals.user) return json({ error: UNAUTHORIZED }, 401);

  const id = idSchema.safeParse(context.params.id);
  if (!id.success) return invalidRequest();

  const supabase = createClient(context.request.headers, context.cookies);
  if (!supabase) return json({ error: SAVE_FAILED }, 500);

  const body = await readJson(context.request);
  if (body === undefined) return invalidRequest();

  const parsed = patchSchema.safeParse(body);
  if (!parsed.success) return json({ error: parsed.error.issues[0].message }, 400);

  const { amount, extendMonths } = parsed.data;
  if (amount !== undefined) {
    return recurringIncomeResponse(await updateRecurringIncomeAmount(supabase, id.data, amount));
  }
  if (extendMonths !== undefined) {
    return recurringIncomeResponse(await extendRecurringIncome(supabase, id.data, extendMonths));
  }
  return recurringIncomeResponse(await dismissRecurringIncomeReminder(supabase, id.data));
};

/** Stops the definition: its entries dated after today are deleted, earlier ones stay. */
export const DELETE: APIRoute = async (context) => {
  if (!context.locals.user) return json({ error: UNAUTHORIZED }, 401);

  const id = idSchema.safeParse(context.params.id);
  if (!id.success) return invalidRequest();

  const supabase = createClient(context.request.headers, context.cookies);
  if (!supabase) return json({ error: SAVE_FAILED }, 500);

  return recurringIncomeResponse(await stopRecurringIncome(supabase, id.data));
};
