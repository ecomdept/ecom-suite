import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";

export async function redirectIfAuthenticated() {
  const supabase = await createClient();
  const { data } = await supabase.auth.getClaims();

  if (data?.claims) redirect("/dashboard");
}

export async function requireUser() {
  const supabase = await createClient();
  const { data, error } = await supabase.auth.getClaims();

  if (error || !data?.claims) redirect("/auth/login");

  return { supabase, claims: data.claims };
}
