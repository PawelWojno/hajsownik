import type { APIRoute } from "astro";
import { z } from "zod";
import { entryResponse } from "@/lib/entry-http";
import { SAVE_FAILED, UNAUTHORIZED, invalidRequest, json, readJson } from "@/lib/http";
import { deleteEntry, updateExpense } from "@/lib/services/entries";
import { createClient } from "@/lib/supabase";
import { expensePatchSchema } from "@/lib/validation";

export const prerender = false;

const idSchema = z.uuid();

export const PATCH: APIRoute = async (context) => {
  if (!context.locals.user) return json({ error: UNAUTHORIZED }, 401);

  const id = idSchema.safeParse(context.params.id);
  if (!id.success) return invalidRequest();

  const supabase = createClient(context.request.headers, context.cookies);
  if (!supabase) return json({ error: SAVE_FAILED }, 500);

  const body = await readJson(context.request);
  if (body === undefined) return invalidRequest();

  const parsed = expensePatchSchema.safeParse(body);
  if (!parsed.success) return json({ error: parsed.error.issues[0].message }, 400);

  const { amount, categoryId, date, description } = parsed.data;
  return entryResponse(await updateExpense(supabase, id.data, { amountMinor: amount, categoryId, date, description }));
};

export const DELETE: APIRoute = async (context) => {
  if (!context.locals.user) return json({ error: UNAUTHORIZED }, 401);

  const id = idSchema.safeParse(context.params.id);
  if (!id.success) return invalidRequest();

  const supabase = createClient(context.request.headers, context.cookies);
  if (!supabase) return json({ error: SAVE_FAILED }, 500);

  return entryResponse(await deleteEntry(supabase, "expense", id.data));
};
