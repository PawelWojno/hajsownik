import type { APIRoute } from "astro";
import { z } from "zod";
import { INVALID_REQUEST, SAVE_FAILED, UNAUTHORIZED, json } from "@/lib/http";
import { categoryResponse, invalidRequest, readJson, reorderCategories } from "@/lib/services/categories";
import { createClient } from "@/lib/supabase";

export const prerender = false;

const reorderSchema = z.object({ ids: z.array(z.uuid(INVALID_REQUEST)).max(500) });

export const POST: APIRoute = async (context) => {
  if (!context.locals.user) return json({ error: UNAUTHORIZED }, 401);

  const supabase = createClient(context.request.headers, context.cookies);
  if (!supabase) return json({ error: SAVE_FAILED }, 500);

  const body = await readJson(context.request);
  if (body === undefined) return invalidRequest();

  const parsed = reorderSchema.safeParse(body);
  if (!parsed.success) return json({ error: parsed.error.issues[0].message }, 400);

  return categoryResponse(await reorderCategories(supabase, parsed.data.ids));
};
