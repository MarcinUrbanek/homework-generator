import type { APIRoute } from "astro";
import { returnDestination } from "@/lib/auth/return-destination";
import { createClient } from "@/lib/supabase";

export interface SignInHandlerDependencies {
  createSupabaseClient?: typeof createClient;
}

function signinPageUrl(error: string, returnTo: string): string {
  return `/auth/signin?${new URLSearchParams({ error, return_to: returnTo })}`;
}

export function createSignInHandler(dependencies: SignInHandlerDependencies = {}): APIRoute {
  const createSupabaseClient = dependencies.createSupabaseClient ?? createClient;

  return async (context) => {
    const form = await context.request.formData();
    const email = form.get("email") as string;
    const password = form.get("password") as string;
    const returnTo = returnDestination(form.get("return_to"));

    const supabase = createSupabaseClient(context.request.headers, context.cookies);
    if (!supabase) {
      return context.redirect(signinPageUrl("Supabase is not configured", returnTo));
    }
    const { error } = await supabase.auth.signInWithPassword({ email, password });

    if (error) {
      return context.redirect(signinPageUrl(error.message, returnTo));
    }

    return context.redirect(returnTo);
  };
}

export const POST = createSignInHandler();
