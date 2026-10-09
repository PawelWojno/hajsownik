import type { APIRoute } from "astro";
import { z } from "zod";
import { INVALID_REQUEST, SAVE_FAILED, UNAUTHORIZED, json } from "@/lib/http";
import {
  categoryResponse,
  deleteCategory,
  invalidRequest,
  readJson,
  renameCategory,
  setArchived,
} from "@/lib/services/categories";
import { createClient } from "@/lib/supabase";
import { categoryNameField } from "@/lib/validation";

export const prerender = false;

const idSchema = z.uuid();

// Exactly one of the two fields: either a rename or an archive/restore.
const patchSchema = z
  .object({ name: categoryNameField.optional(), archived: z.boolean().optional() })
  .refine((value) => (value.name === undefined) !== (value.archived === undefined), INVALID_REQUEST);

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

  const { name, archived } = parsed.data;
  return categoryResponse(
    name !== undefined
      ? await renameCategory(supabase, id.data, name)
      : await setArchived(supabase, id.data, !!archived),
  );
};

export const DELETE: APIRoute = async (context) => {
  if (!context.locals.user) return json({ error: UNAUTHORIZED }, 401);

  const id = idSchema.safeParse(context.params.id);
  if (!id.success) return invalidRequest();

  const supabase = createClient(context.request.headers, context.cookies);
  if (!supabase) return json({ error: SAVE_FAILED }, 500);

  return categoryResponse(await deleteCategory(supabase, id.data));
};
