import type { SupabaseClient } from "@supabase/supabase-js";
import { logInvoiceEvent } from "@/lib/data/commercial-ops";

const TOKEN_PATTERN = /^[a-f0-9]{64}$/i;

export function isValidPublicInvoiceToken(token: string | null | undefined) {
  return TOKEN_PATTERN.test(String(token ?? "").trim());
}

export async function loadInvoiceByPublicToken(supabase: SupabaseClient<any>, token: string) {
  const normalizedToken = token.trim();
  if (!isValidPublicInvoiceToken(normalizedToken)) return null;

  const { data: invoice, error } = await supabase
    .from("invoices")
    .select(
      "id,invoice_number,customer_name,customer_email,customer_phone,currency,subtotal,vat_rate,vat_amount,total_amount,status,due_date,issued_at,updated_at,msme_id,provider_profile_id,public_token,public_token_expires_at,public_token_revoked_at,msmes(business_name,contact_email,contact_phone,address,state,lga),provider_profiles(display_name,contact_email,contact_phone)"
    )
    .eq("public_token", normalizedToken)
    .is("public_token_revoked_at", null)
    .gt("public_token_expires_at", new Date().toISOString())
    .maybeSingle();

  if (error || !invoice) {
    if (error) console.info("[public-invoice:token-load-failed]", { operation: "public_invoice_access", code: error.code ?? null, message: error.message });
    return null;
  }

  return invoice;
}

export async function logPublicInvoiceAccess(supabase: SupabaseClient<any>, invoiceId: string, eventType: string, metadata: Record<string, unknown> = {}) {
  await logInvoiceEvent(supabase, {
    invoiceId,
    eventType,
    actorRole: "public",
    actorId: null,
    source: "public_token",
    metadata,
  });
}
