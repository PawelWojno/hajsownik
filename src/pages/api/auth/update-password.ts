import type { APIRoute } from "astro";
import { z } from "zod";
import { redirectOnGet } from "@/lib/auth-get";
import { createClient } from "@/lib/supabase";

export const prerender = false;

// GET only redirects (to /dashboard or /auth/signin) and must never do anything else: see the safety rules in
// src/lib/auth-get.ts before touching it.
export const GET = redirectOnGet;

const updatePasswordSchema = z
  .object({
    password: z.string("Password is required").min(6, "Password must be at least 6 characters"),
    confirmPassword: z.string("Please confirm your password"),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: "Passwords do not match",
    path: ["confirmPassword"],
  });

export const POST: APIRoute = async (context) => {
  const supabase = createClient(context.request.headers, context.cookies);
  if (!supabase) {
    return context.redirect(`/auth/update-password?error=${encodeURIComponent("Supabase is not configured")}`);
  }

  // The session comes from the reset link (see reset-callback.ts); updateUser changes the password of that user only.
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return context.redirect("/auth/signin");
  }

  const form = await context.request.formData();
  const parsed = updatePasswordSchema.safeParse(Object.fromEntries(form));
  if (!parsed.success) {
    return context.redirect(`/auth/update-password?error=${encodeURIComponent(parsed.error.issues[0].message)}`);
  }

  const { error } = await supabase.auth.updateUser({ password: parsed.data.password });
  if (error) {
    return context.redirect(`/auth/update-password?error=${encodeURIComponent(error.message)}`);
  }

  // The password is already changed at this point, so ending the other sessions is best effort: it must not turn a
  // successful reset into an error. A reset often follows a suspected takeover, so an old session must not survive it.
  await supabase.auth.signOut({ scope: "others" });

  return context.redirect("/dashboard");
};
