import type { APIRoute } from "astro";
import { z } from "zod";
import { SAVE_FAILED, UNAUTHORIZED, json } from "@/lib/http";
import { addCategory, categoryResponse, invalidRequest, readJson } from "@/lib/services/categories";
import { createClient } from "@/lib/supabase";
import { categoryNameField } from "@/lib/validation";

export const prerender = false;

const addSchema = z.object({ name: categoryNameField });

export const POST: APIRoute = async (context) => {
  if (!context.locals.user) return json({ error: UNAUTHORIZED }, 401);

  const supabase = createClient(context.request.headers, context.cookies);
  if (!supabase) return json({ error: SAVE_FAILED }, 500);

  const body = await readJson(context.request);
  if (body === undefined) return invalidRequest();

  const parsed = addSchema.safeParse(body);
  if (!parsed.success) return json({ error: parsed.error.issues[0].message }, 400);

  return categoryResponse(await addCategory(supabase, parsed.data.name));
};
