import type { APIRoute } from "astro";
import { z } from "zod";
import { createClient } from "@/lib/supabase";

export const prerender = false;

const callbackSchema = z.object({ code: z.string().min(1) });

// Supabase's own message is technical (e.g. a missing PKCE code verifier when the link is opened in another browser),
// so show the user something they can act on.
const RESET_LINK_FAILED_MESSAGE =
  "This reset link is invalid, has expired, or was opened in a different browser than the one you requested it from. Please request a new link.";

const failure = (context: Parameters<APIRoute>[0], message: string) =>
  context.redirect(`/auth/forgot-password?error=${encodeURIComponent(message)}`);

export const GET: APIRoute = async (context) => {
  const parsed = callbackSchema.safeParse(Object.fromEntries(context.url.searchParams));
  if (!parsed.success) {
    return failure(context, RESET_LINK_FAILED_MESSAGE);
  }

  const supabase = createClient(context.request.headers, context.cookies);
  if (!supabase) {
    return failure(context, "Supabase is not configured");
  }

  const { error } = await supabase.auth.exchangeCodeForSession(parsed.data.code);
  if (error) {
    return failure(context, RESET_LINK_FAILED_MESSAGE);
  }

  return context.redirect("/auth/update-password");
};
