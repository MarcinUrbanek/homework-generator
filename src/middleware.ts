import { defineMiddleware } from "astro:middleware";
import { createClient } from "@/lib/supabase";

const PROTECTED_ROUTES = ["/dashboard", "/exercises", "/classes"];

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

  if (
    PROTECTED_ROUTES.some((route) => context.url.pathname.startsWith(route)) &&
    context.url.pathname !== "/classes/join"
  ) {
    if (!context.locals.user) {
      const returnTo = `${context.url.pathname}${context.url.search}`;
      return context.redirect(`/auth/signin?${new URLSearchParams({ return_to: returnTo })}`);
    }
  }

  return next();
});
