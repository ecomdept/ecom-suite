import { createClient } from "@/lib/supabase/server";
import { type EmailOtpType } from "@supabase/supabase-js";
import { redirect } from "next/navigation";
import { type NextRequest } from "next/server";

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const token_hash = searchParams.get("token_hash");
  const type = searchParams.get("type") as EmailOtpType | null;
  const code = searchParams.get("code");
  const requestedNext = searchParams.get("next") ?? "/dashboard";
  const next = requestedNext.startsWith("/") && !requestedNext.startsWith("//")
    ? requestedNext
    : "/dashboard";
  const supabase = await createClient();
  let error: Error | null = null;

  if (token_hash && type) {
    const result = await supabase.auth.verifyOtp({
      type,
      token_hash,
    });
    error = result.error;
  } else if (code) {
    const result = await supabase.auth.exchangeCodeForSession(code);
    error = result.error;
  } else {
    error = new Error("The confirmation link is incomplete or invalid.");
  }

  if (!error) redirect(next);

  const errorUrl = new URL("/auth/error", request.url);
  errorUrl.searchParams.set("error", "This link is invalid or has expired. Please request a new one.");
  redirect(errorUrl.toString());
}
