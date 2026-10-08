import type { APIRoute } from "astro";
import { z } from "zod";
import { createClient } from "@/lib/supabase";

const householdNameSchema = z.string().trim().min(1).max(100);

export const POST: APIRoute = async (context) => {
  const form = await context.request.formData();
  const email = form.get("email") as string;
  const password = form.get("password") as string;

  const parsedHouseholdName = householdNameSchema.safeParse(form.get("householdName"));
  if (!parsedHouseholdName.success) {
    return context.redirect(
      `/auth/signup?error=${encodeURIComponent("Household name is required and must be at most 100 characters")}`,
    );
  }

  const supabase = createClient(context.request.headers, context.cookies);
  if (!supabase) {
    return context.redirect(`/auth/signup?error=${encodeURIComponent("Supabase is not configured")}`);
  }
  const { error } = await supabase.auth.signUp({
    email,
    password,
    options: { data: { household_name: parsedHouseholdName.data } },
  });

  if (error) {
    return context.redirect(`/auth/signup?error=${encodeURIComponent(error.message)}`);
  }

  return context.redirect("/auth/confirm-email");
};
