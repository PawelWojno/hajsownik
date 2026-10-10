import type { APIRoute } from "astro";
import { z } from "zod";
import { createClient } from "@/lib/supabase";

export const prerender = false;

const callbackSchema = z.object({ code: z.string().min(1) });

export const GET: APIRoute = async (context) => {
  const parsed = callbackSchema.safeParse(Object.fromEntries(context.url.searchParams));
  if (!parsed.success) {
    return context.redirect(`/auth/signin?error=${encodeURIComponent("Invalid or missing confirmation link")}`);
  }

  const supabase = createClient(context.request.headers, context.cookies);
  if (!supabase) {
    return context.redirect(`/auth/signin?error=${encodeURIComponent("Supabase is not configured")}`);
  }

  const { error } = await supabase.auth.exchangeCodeForSession(parsed.data.code);
  if (error) {
    return context.redirect(`/auth/signin?error=${encodeURIComponent(error.message)}`);
  }

  return context.redirect("/dashboard");
};
