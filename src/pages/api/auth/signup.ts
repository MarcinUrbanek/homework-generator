import type { APIRoute } from "astro";
import { returnDestination } from "@/lib/auth/return-destination";
import { createClient } from "@/lib/supabase";

export interface SignUpHandlerDependencies {
  createSupabaseClient?: typeof createClient;
}

function signupPageUrl(error: string, returnTo: string): string {
  return `/auth/signup?${new URLSearchParams({ error, return_to: returnTo })}`;
}

export function createSignUpHandler(dependencies: SignUpHandlerDependencies = {}): APIRoute {
  const createSupabaseClient = dependencies.createSupabaseClient ?? createClient;

  return async (context) => {
    const form = await context.request.formData();
    const email = form.get("email") as string;
    const password = form.get("password") as string;
    const returnTo = returnDestination(form.get("return_to"));

    const supabase = createSupabaseClient(context.request.headers, context.cookies);
    if (!supabase) {
      return context.redirect(signupPageUrl("Supabase is not configured", returnTo));
    }
    const { error } = await supabase.auth.signUp({ email, password });

    if (error) {
      return context.redirect(signupPageUrl(error.message, returnTo));
    }

    return context.redirect(`/auth/confirm-email?${new URLSearchParams({ return_to: returnTo })}`);
  };
}

export const POST = createSignUpHandler();
