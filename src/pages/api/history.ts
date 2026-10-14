import type { APIRoute } from "astro";
import { parseHistoryParams, toHistoryQuery } from "@/lib/history-params";
import { SAVE_FAILED, UNAUTHORIZED, json } from "@/lib/http";
import { listHistory } from "@/lib/services/entries";
import { createClient } from "@/lib/supabase";

export const prerender = false;

// The middleware only guards pages, so the session is checked here.
export const GET: APIRoute = async (context) => {
  if (!context.locals.user) return json({ error: UNAUTHORIZED }, 401);

  const supabase = createClient(context.request.headers, context.cookies);
  if (!supabase) return json({ error: SAVE_FAILED }, 500);

  const params = parseHistoryParams(new URL(context.request.url).searchParams);
  return json(await listHistory(supabase, toHistoryQuery(params)));
};
