import type { APIRoute } from "astro";
import { z } from "zod";
import { createClient } from "@/lib/supabase";

export const prerender = false;

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

  return context.redirect("/dashboard");
};
