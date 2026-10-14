import type { APIRoute } from "astro";
import { redirectOnGet } from "@/lib/auth-get";
import { createClient } from "@/lib/supabase";

export const prerender = false;

// GET only redirects (to /dashboard or /auth/signin) and must never do anything else: see the safety rules in
// src/lib/auth-get.ts before touching it.
export const GET = redirectOnGet;

export const POST: APIRoute = async (context) => {
  const form = await context.request.formData();
  const email = form.get("email") as string;
  const password = form.get("password") as string;

  const supabase = createClient(context.request.headers, context.cookies);
  if (!supabase) {
    return context.redirect(`/auth/signin?error=${encodeURIComponent("Supabase is not configured")}`);
  }
  const { error } = await supabase.auth.signInWithPassword({ email, password });

  if (error) {
    return context.redirect(`/auth/signin?error=${encodeURIComponent(error.message)}`);
  }

  return context.redirect("/dashboard");
};
