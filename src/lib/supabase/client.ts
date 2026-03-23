import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || "https://demo.supabase.co";
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "demo-anon-key";

let browserClient: ReturnType<typeof createClient> | null = null;

function getBrowserSupabaseClient() {
  if (!browserClient) {
    browserClient = createClient(supabaseUrl, supabaseAnonKey);
  }
  return browserClient;
}

export const supabase = getBrowserSupabaseClient();

export function createSupabaseBrowserClient() {
  return getBrowserSupabaseClient();
}
