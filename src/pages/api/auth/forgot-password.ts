import type { APIRoute } from "astro";
import { z } from "zod";
import { redirectOnGet } from "@/lib/auth-get";
import { createClient } from "@/lib/supabase";

export const prerender = false;

// GET only redirects (to /dashboard or /auth/signin) and must never do anything else: see the safety rules in
// src/lib/auth-get.ts before touching it.
export const GET = redirectOnGet;

const forgotPasswordSchema = z.object({
  email: z.email("Please enter a valid email address"),
});

const SEND_FAILED_MESSAGE = "We couldn't send the email right now. Please try again in a minute.";

export const POST: APIRoute = async (context) => {
  const form = await context.request.formData();

  const parsed = forgotPasswordSchema.safeParse(Object.fromEntries(form));
  if (!parsed.success) {
    return context.redirect(`/auth/forgot-password?error=${encodeURIComponent(parsed.error.issues[0].message)}`);
  }

  const supabase = createClient(context.request.headers, context.cookies);
  if (!supabase) {
    return context.redirect(`/auth/forgot-password?error=${encodeURIComponent("Supabase is not configured")}`);
  }

  const { error } = await supabase.auth.resetPasswordForEmail(parsed.data.email, {
    redirectTo: `${context.url.origin}/auth/reset-callback`,
  });
  if (error) {
    return context.redirect(`/auth/forgot-password?error=${encodeURIComponent(SEND_FAILED_MESSAGE)}`);
  }

  // Supabase answers the same way for an unknown address, so the page never reveals whether an account exists.
  return context.redirect("/auth/forgot-password?sent=1");
};
