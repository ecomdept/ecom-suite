import { createClient } from "@supabase/supabase-js";

export function createScriptClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const secretKey = process.env.SUPABASE_SECRET_KEY;

  if (!url) throw new Error("NEXT_PUBLIC_SUPABASE_URL is not set. Add it to .env.local.");
  if (!secretKey) throw new Error("SUPABASE_SECRET_KEY is not set. Add it to .env.local.");

  return createClient(url, secretKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}
