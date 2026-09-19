"use server";

import { createClient } from "@/lib/supabase/server";
import {
  getSafePath,
  validateEmail,
  validatePassword,
} from "@/lib/auth/validation";
import { headers } from "next/headers";
import { redirect } from "next/navigation";

export type AuthActionState = {
  error?: string;
  success?: string;
};

function getString(formData: FormData, key: string) {
  const value = formData.get(key);
  return typeof value === "string" ? value : "";
}

async function getOrigin() {
  const requestHeaders = await headers();
  const host = requestHeaders.get("x-forwarded-host") ?? requestHeaders.get("host");
  const protocol = requestHeaders.get("x-forwarded-proto") ?? "http";

  if (host) return `${protocol}://${host}`;

  return process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";
}

export async function signInAction(
  previousState: AuthActionState,
  formData: FormData,
): Promise<AuthActionState> {
  void previousState;
  const email = getString(formData, "email").trim().toLowerCase();
  const password = getString(formData, "password");
  const emailError = validateEmail(email);

  if (emailError) return { error: emailError };
  if (!password) return { error: "Password is required." };

  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword({ email, password });

  if (error) {
    return { error: "Unable to sign in. Check your email and password and try again." };
  }

  redirect(getSafePath(formData.get("next")));
}

export async function forgotPasswordAction(
  previousState: AuthActionState,
  formData: FormData,
): Promise<AuthActionState> {
  void previousState;
  const email = getString(formData, "email").trim().toLowerCase();
  const emailError = validateEmail(email);

  if (emailError) return { error: emailError };

  const supabase = await createClient();
  const origin = await getOrigin();
  const { error } = await supabase.auth.resetPasswordForEmail(email, {
    redirectTo: `${origin}/auth/confirm?next=/auth/update-password`,
  });

  if (error) return { error: "We could not send a reset email. Please try again." };

  return {
    success:
      "If an account exists for that email, a password reset link is on its way.",
  };
}

export async function updatePasswordAction(
  previousState: AuthActionState,
  formData: FormData,
): Promise<AuthActionState> {
  void previousState;
  const password = getString(formData, "password");
  const confirmPassword = getString(formData, "confirmPassword");
  const flow = getString(formData, "flow");
  const passwordError = validatePassword(password);

  if (passwordError) return { error: passwordError };
  if (password !== confirmPassword) return { error: "Passwords do not match." };

  const supabase = await createClient();
  const { data } = await supabase.auth.getClaims();

  if (!data?.claims) {
    return { error: "This reset link is invalid or has expired. Request a new one." };
  }

  const { error } = await supabase.auth.updateUser({ password });
  if (error) return { error: error.message };

  return {
    success:
      flow === "invite"
        ? "Your account is ready. You can now continue to your dashboard."
        : "Your password has been updated. You can continue to your dashboard.",
  };
}

export async function signOutAction() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/auth/login");
}
