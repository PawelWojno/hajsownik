import type { APIRoute } from "astro";
import { todayInWarsaw } from "@/lib/dates";
import { INVALID_REQUEST, SAVE_FAILED, UNAUTHORIZED, json } from "@/lib/http";
import { buildSavedResponse } from "@/lib/services/month";
import { createClient } from "@/lib/supabase";
import { incomeCreateSchema } from "@/lib/validation";

export const prerender = false;

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

  const parsed = incomeCreateSchema.safeParse(body);
  if (!parsed.success) return json({ error: parsed.error.issues[0].message }, 400);
  const { amount, source } = parsed.data;
  const date = parsed.data.date ?? todayInWarsaw();

  // household_id is not sent: the column defaults to the caller's household and RLS enforces it.
  const { error } = await supabase.from("incomes").insert({ source, amount_minor: amount, received_on: date });
  if (error) return json({ error: SAVE_FAILED }, 500);

  return json(await buildSavedResponse(supabase, date));
};
