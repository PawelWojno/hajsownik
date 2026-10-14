import type { APIRoute } from "astro";

/**
 * GET handler shared by the auth form endpoints in src/pages/api/auth/ (they do their work on POST only).
 *
 * WHY IT EXISTS: every auth form posts to its endpoint, which answers with a redirect. The browser keeps that endpoint
 * as the "original request URL" of the page it lands on, and some actions re-request it as a plain GET: e.g. "Request
 * desktop site" in Brave / Chrome on Android. Without a GET export the user got a bare 404 page.
 *
 * SAFETY RULES. Do not "improve" this handler, here or by adding logic to a GET export in an auth route:
 *   1. It must NEVER sign in, sign out, sign up, send an email or change a password. A GET can be triggered by any other
 *      site (<img src="…/api/auth/signout">), by link previews, by prefetching and by mail scanners, and the browser sends
 *      the session cookies with it. An action on GET would let anyone sign users out or worse. Actions stay on POST.
 *   2. It must NEVER read input (query string, body): credentials in a URL end up in history, logs and Referer headers.
 *   3. It must ONLY redirect to one of the two fixed paths below, never to a URL taken from the request (that would be
 *      an open redirect, usable for phishing with our domain in the link).
 *   4. `Cache-Control: no-store`: the target depends on the session, so the answer must not be cached for anyone else.
 * The smoke test (scripts/smoke.mjs) checks that GET /api/auth/signout leaves the session signed in.
 */
export const redirectOnGet: APIRoute = (context) =>
  new Response(null, {
    status: 302,
    headers: {
      Location: context.locals.user ? "/dashboard" : "/auth/signin",
      "Cache-Control": "no-store",
    },
  });
