"use server";

import { type EmailOtpType } from "@supabase/supabase-js";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getSafePath } from "@/lib/auth/validation";

const otpTypes: EmailOtpType[] = [
  "email",
  "invite",
  "magiclink",
  "recovery",
  "signup",
  "email_change",
];

function getString(formData: FormData, key: string) {
  const value = formData.get(key);
  return typeof value === "string" ? value : "";
}

function isEmailOtpType(value: string): value is EmailOtpType {
  return otpTypes.includes(value as EmailOtpType);
}

export async function confirmAuthAction(formData: FormData) {
  const tokenHash = getString(formData, "tokenHash");
  const type = getString(formData, "type");
  const code = getString(formData, "code");
  const next = getSafePath(formData.get("next"));
  const supabase = await createClient();

  if (tokenHash && isEmailOtpType(type)) {
    const { error } = await supabase.auth.verifyOtp({
      token_hash: tokenHash,
      type,
    });

    if (!error) redirect(next);
  } else if (code) {
    const { error } = await supabase.auth.exchangeCodeForSession(code);

    if (!error) redirect(next);
  }

  redirect(
    "/auth/error?error=This%20link%20is%20invalid%20or%20has%20expired.%20Please%20request%20a%20new%20one.",
  );
}
