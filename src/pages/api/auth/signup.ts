import type { APIRoute } from "astro";
import { z } from "zod";
import { createClient } from "@/lib/supabase";

const HOUSEHOLD_NAME_ERROR = "Household name is required and must be at most 100 characters";

const signUpSchema = z.object({
  email: z.email("Please enter a valid email address"),
  password: z.string("Password is required").min(6, "Password must be at least 6 characters"),
  householdName: z.string(HOUSEHOLD_NAME_ERROR).trim().min(1, HOUSEHOLD_NAME_ERROR).max(100, HOUSEHOLD_NAME_ERROR),
});

export const POST: APIRoute = async (context) => {
  const form = await context.request.formData();

  const parsed = signUpSchema.safeParse(Object.fromEntries(form));
  if (!parsed.success) {
    return context.redirect(`/auth/signup?error=${encodeURIComponent(parsed.error.issues[0].message)}`);
  }
  const { email, password, householdName } = parsed.data;

  const supabase = createClient(context.request.headers, context.cookies);
  if (!supabase) {
    return context.redirect(`/auth/signup?error=${encodeURIComponent("Supabase is not configured")}`);
  }
  const { error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      data: { household_name: householdName },
      emailRedirectTo: `${context.url.origin}/auth/callback`,
    },
  });

  if (error) {
    return context.redirect(`/auth/signup?error=${encodeURIComponent(error.message)}`);
  }

  return context.redirect("/auth/confirm-email");
};
