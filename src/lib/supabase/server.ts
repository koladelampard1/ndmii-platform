import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL || "https://demo.supabase.co";
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "demo-anon-key";

export async function createServerSupabaseClient() {
  return createClient(supabaseUrl, supabaseAnonKey);
}

export async function createServiceRoleSupabaseClient() {
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || supabaseUrl.includes("demo.supabase.co")) {
    throw new Error("Server registration is unavailable because Supabase URL is not configured.");
  }

  if (!serviceRoleKey) {
    throw new Error("Server registration is unavailable because SUPABASE_SERVICE_ROLE_KEY is not configured.");
  }

  return createClient(supabaseUrl, serviceRoleKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });
}
