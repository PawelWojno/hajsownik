import type { APIRoute } from "astro";
import { z } from "zod";
import { createClient } from "@/lib/supabase";

export const prerender = false;

const callbackSchema = z.object({ code: z.string().min(1) });

// The email is already confirmed by the time Supabase redirects here, so signing in with the password still works.
const CONFIRMATION_FAILED_MESSAGE =
  "Your email is confirmed, but we couldn't sign you in automatically. Please sign in with your email and password.";

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
    // Supabase's message is technical (e.g. a missing PKCE code verifier when the link is opened on another device),
    // so show the user something they can act on instead.
    return context.redirect(`/auth/signin?error=${encodeURIComponent(CONFIRMATION_FAILED_MESSAGE)}`);
  }

  return context.redirect("/dashboard");
};
