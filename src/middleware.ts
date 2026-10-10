import { defineMiddleware } from "astro:middleware";
import { createClient } from "@/lib/supabase";

const PROTECTED_ROUTES = ["/dashboard", "/settings", "/auth/update-password"];
// Pages that make no sense for a signed-in user: send them straight to the month screen (exact paths only).
const SIGNED_OUT_ONLY_ROUTES = ["/", "/auth/signin", "/auth/signup", "/auth/forgot-password"];

export const onRequest = defineMiddleware(async (context, next) => {
  const supabase = createClient(context.request.headers, context.cookies);

  if (supabase) {
    const {
      data: { user },
    } = await supabase.auth.getUser();
    context.locals.user = user ?? null;
  } else {
    context.locals.user = null;
  }

  if (PROTECTED_ROUTES.some((route) => context.url.pathname.startsWith(route))) {
    if (!context.locals.user) {
      return context.redirect("/auth/signin");
    }
  }

  if (context.locals.user && SIGNED_OUT_ONLY_ROUTES.includes(context.url.pathname)) {
    return context.redirect("/dashboard");
  }

  return next();
});
