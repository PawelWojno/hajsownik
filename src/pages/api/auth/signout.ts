import type { APIRoute } from "astro";
import { redirectOnGet } from "@/lib/auth-get";
import { createClient } from "@/lib/supabase";

export const prerender = false;

// GET only redirects (to /dashboard or /auth/signin) and must never do anything else: see the safety rules in
// src/lib/auth-get.ts before touching it.
export const GET = redirectOnGet;

export const POST: APIRoute = async (context) => {
  const supabase = createClient(context.request.headers, context.cookies);
  if (supabase) {
    await supabase.auth.signOut();
  }
  return context.redirect("/");
};
