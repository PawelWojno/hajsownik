import type { APIRoute } from "astro";
import { z } from "zod";
import { todayInWarsaw } from "@/lib/dates";
import { INVALID_REQUEST, SAVE_FAILED, UNAUTHORIZED, json } from "@/lib/http";
import { buildSavedResponse } from "@/lib/services/month";
import { createClient } from "@/lib/supabase";
import { amountField, dateField, descriptionField } from "@/lib/validation";

export const prerender = false;

const FOREIGN_KEY_VIOLATION = "23503";

const expenseSchema = z.object({
  amount: amountField,
  categoryId: z.uuid("Wybierz kategorię"),
  date: dateField.optional(),
  description: descriptionField.optional(),
});

export const POST: APIRoute = async (context) => {
  if (!context.locals.user) return json({ error: UNAUTHORIZED }, 401);

  const supabase = createClient(context.request.headers, context.cookies);
  if (!supabase) return json({ error: SAVE_FAILED }, 500);

  let body: unknown;
  try {
    body = await context.request.json();
  } catch {
    return json({ error: INVALID_REQUEST }, 400);
  }

  const parsed = expenseSchema.safeParse(body);
  if (!parsed.success) return json({ error: parsed.error.issues[0].message }, 400);
  const { amount, categoryId, description } = parsed.data;
  const date = parsed.data.date ?? todayInWarsaw();

  // household_id is not sent: the column defaults to the caller's household and RLS enforces it.
  const { error } = await supabase.from("expenses").insert({
    category_id: categoryId,
    amount_minor: amount,
    spent_on: date,
    description: description === undefined || description === "" ? null : description,
  });
  if (error) {
    // A category of another household (or a made-up id) fails the composite foreign key.
    if (error.code === FOREIGN_KEY_VIOLATION) return json({ error: "Wybierz kategorię z listy" }, 400);
    return json({ error: SAVE_FAILED }, 500);
  }

  return json(await buildSavedResponse(supabase, date));
};
