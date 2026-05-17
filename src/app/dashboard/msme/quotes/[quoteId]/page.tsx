import Link from "next/link";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { getCurrentUserContext } from "@/lib/auth/session";
import { getProviderWorkspaceContext } from "@/lib/data/provider-operations";
import { isUuidLike } from "@/lib/data/provider-quote-ownership";
import { calculateLineTotal, generateInvoiceNumber, generatePublicInvoiceToken, publicInvoiceTokenExpiry, recalculateInvoiceTotals } from "@/lib/data/invoicing";
import {
  filterPayloadByColumns,
  getTableColumns,
  logActivityEvent,
  logInvoiceEvent,
  pickExistingColumns,
  normalizeInvoiceStatus,
} from "@/lib/data/commercial-ops";
import { createServiceRoleSupabaseClient } from "@/lib/supabase/server";

const DEV_MODE = process.env.NODE_ENV !== "production";
const QUOTE_STATUSES = ["new", "in_review", "quoted", "accepted", "declined", "converted", "closed"] as const;
type QuoteStatus = (typeof QUOTE_STATUSES)[number];

function devQuoteLog(message: string, payload: Record<string, unknown>) {
  if (!DEV_MODE) return;
  console.info(`[quote-workflow] ${message}`, payload);
}

function normalizeQuoteStatus(value: unknown): QuoteStatus {
  const status = String(value ?? "new").toLowerCase();
  return QUOTE_STATUSES.includes(status as QuoteStatus) ? (status as QuoteStatus) : "new";
}

function formatNaira(value: number | string | null | undefined) {
  return `₦${Number(value ?? 0).toLocaleString("en-NG", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function formatDateTime(value: string | null | undefined) {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  return date.toLocaleString("en-NG", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function statusLabel(status: string) {
  const normalized = normalizeQuoteStatus(status);
  if (normalized === "new") return "New";
  if (normalized === "in_review") return "In Review";
  if (normalized === "quoted") return "Offer Sent";
  if (normalized === "accepted") return "Accepted";
  if (normalized === "declined") return "Declined";
  if (normalized === "converted") return "Converted";
  return "Closed";
}

function buildAdaptiveInsertPayload(
  columns: Set<string>,
  rawPayload: Record<string, unknown>,
  requiredKeys: string[] = []
) {
  const filteredPayload =
    columns.size > 0
      ? filterPayloadByColumns(rawPayload, columns)
      : Object.fromEntries(Object.entries(rawPayload).filter(([key]) => requiredKeys.includes(key)));
  for (const key of requiredKeys) {
    if (rawPayload[key] !== undefined) {
      filteredPayload[key] = rawPayload[key];
    }
  }
  return filteredPayload;
}


async function getFreshTableColumns(
  supabase: Awaited<ReturnType<typeof createServiceRoleSupabaseClient>>,
  tableName: string
) {
  const { data, error } = await supabase
    .from("information_schema.columns")
    .select("column_name")
    .eq("table_schema", "public")
    .eq("table_name", tableName);

  if (error) {
    devQuoteLog("schema:fresh_lookup_error", {
      tableName,
      message: error.message,
      code: error.code ?? null,
      details: error.details ?? null,
    });
    return getTableColumns(supabase, tableName);
  }

  return new Set((data ?? []).map((row) => String(row.column_name)));
}


async function loadQuoteForCurrentProvider(
  supabase: Awaited<ReturnType<typeof createServiceRoleSupabaseClient>>,
  workspace: Awaited<ReturnType<typeof getProviderWorkspaceContext>>,
  quoteId: string,
  requiredSelectFields: string[]
): Promise<{ quote: any; quoteColumns: Set<string> }> {
  const quoteColumns = await getTableColumns(supabase, "provider_quotes");
  const selectFields = Array.from(new Set([...requiredSelectFields, "provider_profile_id"]));
  const selectClause = selectFields.join(",");

  const { data: quote, error: quoteLoadError }: { data: any; error: any } = await supabase
    .from("provider_quotes")
    .select(selectClause)
    .eq("id", quoteId)
    .maybeSingle();

  if (quoteLoadError || !quote) {
    devQuoteLog("quote_load:missing_after_id_filter", {
      quoteId,
      message: quoteLoadError?.message ?? null,
      code: quoteLoadError?.code ?? null,
    });
    throw new Error("Quote not found for this provider.");
  }

  const quoteOwnership = {
    isOwned: quote.provider_profile_id === workspace.provider.id,
    matchReason: quote.provider_profile_id === workspace.provider.id ? "provider_profile_id === workspace.provider.id" : "provider_profile_id_mismatch",
    quoteKeys: { provider_profile_id: quote.provider_profile_id ?? null },
    workspaceKeys: { provider_id: workspace.provider.id ?? null },
  };
  devQuoteLog("quote_ownership_checked", {
    quoteId,
    providerId: workspace.provider.id,
    matched: quoteOwnership.isOwned,
    reason: quoteOwnership.matchReason,
  });

  if (!quoteOwnership.isOwned) {
    throw new Error("Quote not found for this provider.");
  }

  return { quote, quoteColumns };
}
async function resolveInvoiceMsmeRef(
  supabase: Awaited<ReturnType<typeof createServiceRoleSupabaseClient>>,
  params: {
    workspaceMsmeId: string | null;
    workspaceMsmePublicId: string | null;
    providerProfileId: string;
    providerMsmeId: string | null;
    linkedMsmeId: string | null;
    quoteMsmeId: string | null;
  }
) {
  const { data: providerRow, error: providerLookupError } = await supabase
    .from("provider_profiles")
    .select("id,msme_id")
    .eq("id", params.providerProfileId)
    .maybeSingle();

  const providerDbMsmeId = providerRow?.msme_id ? String(providerRow.msme_id) : null;
  const rawCandidates = [
    params.workspaceMsmeId,
    params.linkedMsmeId,
    params.quoteMsmeId,
    params.workspaceMsmePublicId,
    params.providerMsmeId,
    providerDbMsmeId,
  ].filter((value): value is string => Boolean(value && String(value).trim().length > 0));
  const uniqueCandidates = Array.from(new Set(rawCandidates.map((value) => value.trim())));

  const uuidCandidates = uniqueCandidates.filter((value) => isUuidLike(value));
  const publicIdCandidates = uniqueCandidates.filter((value) => !isUuidLike(value));

  let resolvedMsmeUuid: string | null = null;
  let resolvedPublicMsmeId: string | null = null;

  if (uuidCandidates.length > 0) {
    const { data: msmesById, error: msmesByIdError } = await supabase
      .from("msmes")
      .select("id,msme_id")
      .in("id", uuidCandidates)
      .limit(1);
    if (msmesByIdError) {
      devQuoteLog("convert:msme_uuid_lookup_error", {
        message: msmesByIdError.message,
        code: msmesByIdError.code ?? null,
      });
    }
    const matched = (msmesById ?? [])[0] as { id?: string | null; msme_id?: string | null } | undefined;
    resolvedMsmeUuid = matched?.id ?? uuidCandidates[0] ?? null;
    resolvedPublicMsmeId = matched?.msme_id ?? null;
  }

  if (!resolvedMsmeUuid && publicIdCandidates.length > 0) {
    const { data: msmesByPublic, error: msmesByPublicError } = await supabase
      .from("msmes")
      .select("id,msme_id")
      .in("msme_id", publicIdCandidates)
      .limit(1);

    if (msmesByPublicError) {
      devQuoteLog("convert:msme_public_lookup_error", {
        message: msmesByPublicError.message,
        code: msmesByPublicError.code ?? null,
      });
    }

    const matched = (msmesByPublic ?? [])[0] as { id?: string | null; msme_id?: string | null } | undefined;
    resolvedMsmeUuid = matched?.id ?? null;
    resolvedPublicMsmeId = matched?.msme_id ?? null;
  }

  devQuoteLog("convert:msme_ref_resolution", {
    providerLookupError: providerLookupError?.message ?? null,
    providerDbMsmeId,
    candidates: uniqueCandidates,
    uuidCandidates,
    publicIdCandidates,
    resolvedMsmeUuid,
    resolvedPublicMsmeId,
  });

  return { resolvedMsmeUuid, resolvedPublicMsmeId, providerDbMsmeId };
}

async function updateQuoteStatus(
  supabase: Awaited<ReturnType<typeof createServiceRoleSupabaseClient>>,
  quoteId: string,
  providerId: string,
  actorUserId: string | null,
  actorRole: string,
  previousStatus: string,
  nextStatus: QuoteStatus,
  lifecycleColumn?: "reviewed_at" | "accepted_at" | "declined_at" | "converted_at" | "quote_sent_at" | "customer_decision_at",
  note?: string
) {
  const nowIso = new Date().toISOString();
  const columns = await getTableColumns(supabase, "provider_quotes");
  const adaptivePayload = filterPayloadByColumns(
    {
      status: nextStatus,
      [lifecycleColumn ?? ""]: lifecycleColumn ? nowIso : undefined,
      updated_at: nowIso,
    },
    columns
  );
  const payload: Record<string, unknown> = { status: nextStatus };
  if (columns.has("updated_at")) payload.updated_at = nowIso;
  if (lifecycleColumn && columns.has(lifecycleColumn)) payload[lifecycleColumn] = nowIso;
  if (Object.keys(adaptivePayload).length > 0) {
    Object.assign(payload, adaptivePayload);
  }
  const updateSelect = pickExistingColumns(columns, ["id", "status", "accepted_at", "reviewed_at", "declined_at", "converted_at", "updated_at"]);

  devQuoteLog("update:attempt", {
    quoteId,
    providerId,
    operation: "quote_status_update",
    previousStatus: normalizeQuoteStatus(previousStatus),
    nextStatus,
    lifecycleColumn: lifecycleColumn ?? null,
  });

  const updateQuery = supabase.from("provider_quotes").update(payload).eq("id", quoteId);

  const { error } = updateSelect.length
    ? await updateQuery.select(updateSelect.join(",")).maybeSingle()
    : await updateQuery.select("id,status").maybeSingle();

  if (error) {
    devQuoteLog("update:error", {
      quoteId,
      providerId,
      operation: "quote_status_update",
      previousStatus: normalizeQuoteStatus(previousStatus),
      nextStatus,
      code: error.code ?? null,
      message: error.message,
    });
    throw new Error(`Quote status update failed: ${error.message}`);
  }

  const readBackSelect = updateSelect.length ? updateSelect.join(",") : "id,status";
  const { data: readBackRow, error: readBackError } = await supabase.from("provider_quotes").select(readBackSelect).eq("id", quoteId).maybeSingle();

  if (readBackError) {
    devQuoteLog("update:readback_error", {
      quoteId,
      providerId,
      operation: "quote_status_readback",
      previousStatus: normalizeQuoteStatus(previousStatus),
      nextStatus,
      message: readBackError.message,
      code: readBackError.code ?? null,
    });
    throw new Error(`Quote status read-back failed: ${readBackError.message}`);
  }

  if (!readBackRow) {
    throw new Error("Quote status update failed: quote row not found after update.");
  }

  const readBackStatus = String((readBackRow as { status?: string | null }).status ?? "").toLowerCase();
  if (readBackStatus !== nextStatus) {
    devQuoteLog("update:status_mismatch", {
      quoteId,
      providerId,
      operation: "quote_status_update",
      previousStatus: normalizeQuoteStatus(previousStatus),
      nextStatus,
      readBackStatus,
    });
    throw new Error(`Quote status update mismatch: expected ${nextStatus} but got ${readBackStatus || "empty"}.`);
  }

  await logQuoteStatusHistory(supabase, {
    quoteId,
    fromStatus: normalizeQuoteStatus(previousStatus),
    toStatus: nextStatus,
    actorUserId,
    actorRole,
    note,
  });

  return readBackRow;
}

async function logQuoteStatusHistory(
  supabase: Awaited<ReturnType<typeof createServiceRoleSupabaseClient>>,
  params: {
    quoteId: string;
    fromStatus: string | null;
    toStatus: string;
    actorUserId?: string | null;
    actorRole?: string | null;
    note?: string | null;
  }
) {
  const columns = await getTableColumns(supabase, "quote_status_history");
  if (!columns.has("quote_id") || !columns.has("to_status")) return;

  const payload = filterPayloadByColumns(
    {
      quote_id: params.quoteId,
      from_status: params.fromStatus,
      to_status: params.toStatus,
      changed_by: params.actorUserId ?? null,
      changed_by_role: params.actorRole ?? null,
      note: params.note ?? null,
      created_at: new Date().toISOString(),
    },
    columns
  );

  const { error } = await supabase.from("quote_status_history").insert(payload);
  if (error) {
    devQuoteLog("status_history:error", {
      quoteId: params.quoteId,
      operation: "quote_status_history_insert",
      status: params.toStatus,
      code: error.code ?? null,
      message: error.message,
    });
  }
}

async function quoteWorkflowAction(formData: FormData) {
  "use server";

  const workspace = await getProviderWorkspaceContext();
  const supabase = await createServiceRoleSupabaseClient();

  const quoteId = String(formData.get("quote_id") ?? "");
  const action = String(formData.get("action") ?? "");

  const quoteSelectFields = [
    "id",
    "status",
    "provider_service_id",
    "service_title_snapshot",
    "service_category_snapshot",
    "service_pricing_mode_snapshot",
    "request_summary",
    "request_details",
    "requester_name",
    "requester_email",
    "requester_phone",
    "budget_min",
    "budget_max",
    "quoted_amount",
    "quoted_currency",
    "estimated_timeline",
    "quote_terms",
    "validity_days",
    "provider_response_message",
    "quote_sent_at",
    "customer_decision_at",
  ];
  const { quote } = await loadQuoteForCurrentProvider(supabase, workspace, quoteId, quoteSelectFields);
  const previousStatus = normalizeQuoteStatus(quote.status);

  if (action === "mark_reviewed") {
    if (!["new", "in_review"].includes(previousStatus)) {
      redirect(`/dashboard/msme/quotes/${quote.id}?error=invalid_transition`);
    }
    await updateQuoteStatus(
      supabase,
      quote.id,
      workspace.provider.id,
      workspace.appUserId,
      workspace.role,
      previousStatus,
      "in_review",
      "reviewed_at",
      "Provider started review."
    );
    await logActivityEvent(supabase, {
      action: "quote_reviewed",
      entityType: "provider_quote",
      entityId: quote.id,
      actorUserId: workspace.appUserId,
      metadata: { provider_profile_id: workspace.provider.id },
    });
    revalidatePath(`/dashboard/msme/quotes/${quote.id}`);
    revalidatePath("/dashboard/msme/quotes");
    redirect(`/dashboard/msme/quotes/${quote.id}?saved=1`);
  }

  if (action === "send_quote") {
    if (!["new", "in_review", "quoted"].includes(previousStatus)) {
      redirect(`/dashboard/msme/quotes/${quote.id}?error=invalid_transition`);
    }

    const quotedAmount = Number(formData.get("quoted_amount") ?? 0);
    const estimatedTimeline = String(formData.get("estimated_timeline") ?? "").trim();
    const quoteTerms = String(formData.get("quote_terms") ?? "").trim();
    const validityDays = Number(formData.get("validity_days") ?? 14);
    const providerResponseMessage = String(formData.get("provider_response_message") ?? "").trim();

    if (!Number.isFinite(quotedAmount) || quotedAmount <= 0 || !estimatedTimeline || !quoteTerms || !providerResponseMessage) {
      redirect(`/dashboard/msme/quotes/${quote.id}?error=missing_offer_fields`);
    }
    if (!Number.isInteger(validityDays) || validityDays < 1 || validityDays > 365) {
      redirect(`/dashboard/msme/quotes/${quote.id}?error=invalid_validity`);
    }

    const quoteColumns = await getTableColumns(supabase, "provider_quotes");
    const nowIso = new Date().toISOString();
    const rawPayload = {
      status: "quoted",
      quoted_amount: quotedAmount,
      quoted_currency: "NGN",
      estimated_timeline: estimatedTimeline,
      quote_terms: quoteTerms,
      validity_days: validityDays,
      provider_response_message: providerResponseMessage,
      quote_sent_at: nowIso,
      updated_at: nowIso,
    };
    const payload = quoteColumns.size > 0 ? filterPayloadByColumns(rawPayload, quoteColumns) : rawPayload;

    const { data: updatedQuote, error } = await supabase
      .from("provider_quotes")
      .update(payload)
      .eq("id", quote.id)
      .select("id,status")
      .maybeSingle();

    if (error || normalizeQuoteStatus(updatedQuote?.status) !== "quoted") {
      devQuoteLog("send_quote:error", {
        quoteId: quote.id,
        providerId: workspace.provider.id,
        operation: "send_quote",
        status: updatedQuote?.status ?? null,
        code: error?.code ?? null,
        message: error?.message ?? "status_not_quoted",
      });
      throw new Error(`Quote offer failed: ${error?.message ?? "status_not_quoted"}`);
    }

    await logQuoteStatusHistory(supabase, {
      quoteId: quote.id,
      fromStatus: previousStatus,
      toStatus: "quoted",
      actorUserId: workspace.appUserId,
      actorRole: workspace.role,
      note: previousStatus === "quoted" ? "Commercial offer revised." : "Commercial offer sent.",
    });
    await logActivityEvent(supabase, {
      action: "quote_sent",
      entityType: "provider_quote",
      entityId: quote.id,
      actorUserId: workspace.appUserId,
      metadata: { provider_profile_id: workspace.provider.id },
    });
    revalidatePath(`/dashboard/msme/quotes/${quote.id}`);
    revalidatePath("/dashboard/msme/quotes");
    redirect(`/dashboard/msme/quotes/${quote.id}?saved=1`);
  }

  if (action === "customer_accept") {
    if (previousStatus !== "quoted") {
      redirect(`/dashboard/msme/quotes/${quote.id}?error=quote_not_quoted`);
    }
    await updateQuoteStatus(
      supabase,
      quote.id,
      workspace.provider.id,
      workspace.appUserId,
      workspace.role,
      previousStatus,
      "accepted",
      "customer_decision_at",
      "Customer acceptance recorded."
    );
    await logActivityEvent(supabase, {
      action: "quote_customer_accepted",
      entityType: "provider_quote",
      entityId: quote.id,
      actorUserId: workspace.appUserId,
      metadata: { provider_profile_id: workspace.provider.id },
    });
    revalidatePath(`/dashboard/msme/quotes/${quote.id}`);
    revalidatePath("/dashboard/msme/quotes");
    redirect(`/dashboard/msme/quotes/${quote.id}?saved=1`);
  }

  if (action === "decline") {
    if (["converted", "closed"].includes(previousStatus)) {
      redirect(`/dashboard/msme/quotes/${quote.id}?error=invalid_transition`);
    }
    await updateQuoteStatus(
      supabase,
      quote.id,
      workspace.provider.id,
      workspace.appUserId,
      workspace.role,
      previousStatus,
      "declined",
      "declined_at",
      "Quote declined."
    );
    await logActivityEvent(supabase, {
      action: "quote_declined",
      entityType: "provider_quote",
      entityId: quote.id,
      actorUserId: workspace.appUserId,
      metadata: { provider_profile_id: workspace.provider.id },
    });
    revalidatePath(`/dashboard/msme/quotes/${quote.id}`);
    revalidatePath("/dashboard/msme/quotes");
    redirect(`/dashboard/msme/quotes/${quote.id}?saved=1`);
  }

  if (action === "convert_invoice") {
    const currentUserCtx = await getCurrentUserContext();
    const normalizedQuoteStatus = normalizeQuoteStatus(quote.status);
    const canConvert = normalizedQuoteStatus === "accepted";
    devQuoteLog("convert:gate", {
      quoteId: quote.id,
      providerId: workspace.provider.id,
      operation: "convert_invoice",
      status: normalizedQuoteStatus,
    });
    if (!canConvert) {
      redirect(`/dashboard/msme/quotes/${quote.id}?error=quote_not_accepted`);
    }

    const { data: existingInvoiceLink, error: existingInvoiceLinkError } = await supabase
      .from("quote_invoice_links")
      .select("invoice_id")
      .eq("quote_id", quote.id)
      .limit(1)
      .maybeSingle();
    if (existingInvoiceLinkError) {
      throw new Error(`Invoice conversion lookup failed: ${existingInvoiceLinkError.message}`);
    }
    if (existingInvoiceLink?.invoice_id) {
      redirect(`/dashboard/msme/invoices/${existingInvoiceLink.invoice_id}`);
    }

    const { resolvedMsmeUuid, resolvedPublicMsmeId, providerDbMsmeId } = await resolveInvoiceMsmeRef(supabase, {
      workspaceMsmeId: workspace.msme.id ?? null,
      workspaceMsmePublicId: workspace.msme.msme_id ?? null,
      providerProfileId: workspace.provider.id,
      providerMsmeId: workspace.provider.msme_id ?? null,
      linkedMsmeId: currentUserCtx.linkedMsmeId ?? null,
      quoteMsmeId: String((quote as { msme_id?: string | null }).msme_id ?? "").trim() || null,
    });

    devQuoteLog("convert:context", {
      quoteId: quote.id,
      providerProfileId: workspace.provider.id,
      providerMsmeId: workspace.provider.msme_id ?? null,
      workspaceLinkedMsmeId: currentUserCtx.linkedMsmeId ?? null,
      workspaceMsmeId: workspace.msme.id ?? null,
      workspaceMsmePublicId: workspace.msme.msme_id ?? null,
      quoteRow: {
        id: quote.id,
        status: quote.status,
      },
      invoiceMsmeResolution: {
        resolvedMsmeUuid,
        resolvedPublicMsmeId,
        providerDbMsmeId,
      },
    });

    if (!resolvedMsmeUuid) {
      throw new Error("Invoice creation from quote failed: unable to resolve MSME UUID for invoices.msme_id.");
    }

    if (!isUuidLike(resolvedMsmeUuid)) {
      throw new Error("Resolved MSME ID for invoice is not a UUID");
    }

    const availableInvoicesColumnsSet = await getFreshTableColumns(supabase, "invoices");
    const quoteSummary = String(quote.request_summary ?? "").trim();
    const quoteDetails = String(quote.request_details ?? "").trim();
    const invoiceNotes = [quoteSummary, quoteDetails].filter(Boolean).join(" — ");
    const quotedAmount = Number(quote.quoted_amount ?? quote.budget_max ?? quote.budget_min ?? 0);
    const vatRate = 7.5;
    const subtotal = Number(quotedAmount.toFixed(2));
    if (!Number.isFinite(subtotal) || subtotal <= 0) {
      redirect(`/dashboard/msme/quotes/${quote.id}?error=invalid_invoice_total`);
    }
    const vatAmount = Number(((subtotal * vatRate) / 100).toFixed(2));
    const totalAmount = Number((subtotal + vatAmount).toFixed(2));
    const rawInvoicePayload = {
      provider_profile_id: workspace.provider.id,
      msme_id: resolvedMsmeUuid,
      invoice_number: generateInvoiceNumber(),
      public_token: generatePublicInvoiceToken(),
      public_token_expires_at: publicInvoiceTokenExpiry(),
      public_token_revoked_at: null,
      customer_name: quote.requester_name,
      customer_email: quote.requester_email,
      customer_phone: quote.requester_phone,
      title: quoteSummary || `Quote ${quote.id}`,
      notes: invoiceNotes || null,
      currency: "NGN",
      vat_rate: vatRate,
      subtotal,
      vat_amount: vatAmount,
      total_amount: totalAmount,
      status: normalizeInvoiceStatus("draft"),
      updated_at: new Date().toISOString(),
      quote_id: quote.id,
    };
    const finalInvoiceInsertPayload = buildAdaptiveInsertPayload(availableInvoicesColumnsSet, rawInvoicePayload, [
      "provider_profile_id",
      "msme_id",
      "invoice_number",
      "customer_name",
      "currency",
      "vat_rate",
      "status",
    ]);
    if (!availableInvoicesColumnsSet.has("description") && "description" in finalInvoiceInsertPayload) {
      delete finalInvoiceInsertPayload.description;
    }

    devQuoteLog("invoiceInsertPayload", {
      quoteId: quote.id,
      providerProfileId: workspace.provider.id,
      invoiceColumnsCount: availableInvoicesColumnsSet.size,
    });
    devQuoteLog("resolvedMsmeUuid", { quoteId: quote.id, resolvedMsmeUuid });
    devQuoteLog("resolvedPublicMsmeId", { quoteId: quote.id, resolvedPublicMsmeId });

    const { data: invoiceInsertData, error: invoiceInsertError } = await supabase
      .from("invoices")
      .insert(finalInvoiceInsertPayload)
      .select("id")
      .single();

    devQuoteLog("convert:invoice_insert_result", {
      quoteId: quote.id,
      invoiceInsertError: invoiceInsertError
        ? {
            message: invoiceInsertError.message,
            code: invoiceInsertError.code ?? null,
          }
        : null,
      invoiceInsertData,
    });
    if (invoiceInsertError || !invoiceInsertData) throw new Error(`Invoice creation from quote failed: ${invoiceInsertError?.message ?? "unknown"}`);

    const itemColumns = await getTableColumns(supabase, "invoice_items");
    const seededAmount = subtotal;
    const rawItemPayload = {
      invoice_id: invoiceInsertData.id,
      item_name: quoteSummary || `Quote ${quote.id}`,
      description: quoteDetails || `Auto-created from quote ${quote.id}`,
      quantity: 1,
      unit_price: seededAmount,
      line_total: calculateLineTotal(1, seededAmount),
      vat_applicable: true,
    };
    const itemPayload = buildAdaptiveInsertPayload(itemColumns, rawItemPayload, ["invoice_id", "item_name", "quantity", "unit_price", "line_total", "vat_applicable"]);
    if (Object.keys(itemPayload).length > 0) {
      const { error: itemError } = await supabase.from("invoice_items").insert(itemPayload);
      if (itemError) throw new Error(`Invoice item creation from quote failed: ${itemError.message}`);
    }

    await recalculateInvoiceTotals(invoiceInsertData.id);

    const linkColumns = await getTableColumns(supabase, "quote_invoice_links");
    const canLinkQuoteInvoice = linkColumns.has("quote_id") && linkColumns.has("invoice_id");
    if (canLinkQuoteInvoice) {
      const { error: linkError } = await supabase.from("quote_invoice_links").insert({ quote_id: quote.id, invoice_id: invoiceInsertData.id });
      if (linkError) {
        devQuoteLog("convert:quote_invoice_link_error", {
          quoteId: quote.id,
          invoiceId: invoiceInsertData.id,
          message: linkError.message,
          code: linkError.code ?? null,
        });
        throw new Error(`Invoice link creation from quote failed: ${linkError.message}`);
      }
    } else {
      await logActivityEvent(supabase, {
        action: "quote_invoice_link_fallback",
        entityType: "invoice",
        entityId: invoiceInsertData.id,
        actorUserId: workspace.appUserId,
        metadata: { quote_id: quote.id, link_mode: "metadata_only" },
      });
    }

    await updateQuoteStatus(
      supabase,
      quote.id,
      workspace.provider.id,
      workspace.appUserId,
      workspace.role,
      previousStatus,
      "converted",
      "converted_at",
      "Accepted quote converted to invoice."
    );

    await logInvoiceEvent(supabase, {
      invoiceId: invoiceInsertData.id,
      eventType: "invoice_created",
      actorRole: workspace.role,
      actorId: workspace.msme.id,
      metadata: { quote_id: quote.id, source: "quote_conversion" },
    });

    await logActivityEvent(supabase, {
      action: "invoice_created_from_quote",
      entityType: "invoice",
      entityId: invoiceInsertData.id,
      actorUserId: workspace.appUserId,
      metadata: { quote_id: quote.id, provider_profile_id: workspace.provider.id },
    });

    revalidatePath(`/dashboard/msme/quotes/${quote.id}`);
    revalidatePath("/dashboard/msme/quotes");
    revalidatePath("/dashboard/msme/invoices");
    redirect(`/dashboard/msme/invoices/${invoiceInsertData.id}`);
  }
}

export default async function MsmeQuoteDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ quoteId: string }>;
  searchParams: Promise<{ saved?: string; error?: string }>;
}) {
  const { quoteId } = await params;
  const query = await searchParams;

  const workspace = await getProviderWorkspaceContext();
  const supabase = await createServiceRoleSupabaseClient();

  const quoteSelectFields = [
    "id",
    "provider_service_id",
    "service_title_snapshot",
    "service_category_snapshot",
    "service_pricing_mode_snapshot",
    "requester_name",
    "requester_email",
    "requester_phone",
    "request_summary",
    "request_details",
    "budget_min",
    "budget_max",
    "quoted_amount",
    "quoted_currency",
    "estimated_timeline",
    "quote_terms",
    "validity_days",
    "provider_response_message",
    "quote_sent_at",
    "customer_decision_at",
    "status",
    "created_at",
  ];
  const quotePromise = loadQuoteForCurrentProvider(supabase, workspace, quoteId, quoteSelectFields);

  const invoiceColumns = await getTableColumns(supabase, "invoices");
  const canQueryInvoiceQuoteId = invoiceColumns.has("quote_id");
  const [{ quote }, { data: links, error: linkError }, { data: linkedByQuoteId, error: quoteIdLinkError }, { data: historyRows }] = await Promise.all([
    quotePromise,
    supabase.from("quote_invoice_links").select("invoice_id,created_at").eq("quote_id", quoteId).order("created_at", { ascending: false }),
    canQueryInvoiceQuoteId
      ? supabase
          .from("invoices")
          .select("id,created_at")
          .eq("quote_id", quoteId)
          .eq("provider_profile_id", workspace.provider.id)
          .order("created_at", { ascending: false })
      : Promise.resolve({ data: [], error: null }),
    supabase
      .from("quote_status_history")
      .select("from_status,to_status,changed_by_role,note,created_at")
      .eq("quote_id", quoteId)
      .order("created_at", { ascending: false })
      .limit(20),
  ]);

  if (linkError) {
    console.info("[quote-invoice-links:fallback]", linkError.message);
  }
  if (quoteIdLinkError) {
    console.info("[quote-invoice-links:quote-id-fallback-error]", quoteIdLinkError.message);
  }
  if (!quote) redirect("/dashboard/msme/quotes");

  const linkRows = (links ?? []).map((link: { invoice_id: string; created_at: string }) => ({
    invoice_id: link.invoice_id,
    created_at: link.created_at,
  }));
  const quoteIdRows = (linkedByQuoteId ?? []).map((invoice: { id: string; created_at: string }) => ({
    invoice_id: invoice.id,
    created_at: invoice.created_at,
  }));
  const linkedInvoices = Array.from(
    new Map([...linkRows, ...quoteIdRows].map((row) => [row.invoice_id, row])).values()
  ).sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());

  const normalizedStatus = normalizeQuoteStatus(quote.status);
  const isConverted = normalizedStatus === "converted";
  const isAccepted = normalizedStatus === "accepted";
  const isQuoted = normalizedStatus === "quoted";
  const isDeclined = normalizedStatus === "declined";
  const isPendingReview = ["new", "in_review"].includes(normalizedStatus);
  const showNotAcceptedWarning = query.error === "quote_not_accepted" && !isAccepted && !isConverted;
  const statusHistory = (historyRows ?? []) as Array<{
    from_status: string | null;
    to_status: string;
    changed_by_role: string | null;
    note: string | null;
    created_at: string;
  }>;

  return (
    <section className="space-y-4">
      <header className="rounded-xl border bg-white p-4">
        <p className="text-xs uppercase tracking-wide text-slate-500">Quote request</p>
        <h2 className="text-xl font-semibold">{quote.request_summary}</h2>
        <p className="text-sm text-slate-600">{quote.requester_name} · {quote.requester_email ?? quote.requester_phone ?? "No contact provided"}</p>
      </header>

      {query.saved && <p className="rounded border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-700">Quote action saved.</p>}
      {query.error === "missing_offer_fields" && (
        <p className="rounded border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">Complete amount, timeline, terms, and response message before sending an offer.</p>
      )}
      {query.error === "invalid_validity" && (
        <p className="rounded border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">Quote validity must be between 1 and 365 days.</p>
      )}
      {query.error === "invalid_transition" && (
        <p className="rounded border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">That quote action is not available for the current status.</p>
      )}
      {query.error === "quote_not_quoted" && (
        <p className="rounded border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">Only sent quote offers can be accepted by the customer.</p>
      )}
      {query.error === "invalid_invoice_total" && (
        <p className="rounded border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">This quote needs a positive quoted amount before invoice conversion.</p>
      )}
      {showNotAcceptedWarning && (
        <p className="rounded border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">Only accepted quotes can be converted into invoices.</p>
      )}
      {isConverted && (
        <p className="rounded border border-indigo-200 bg-indigo-50 px-3 py-2 text-sm text-indigo-700">This quote has already been converted into an invoice.</p>
      )}

      <article className="rounded-xl border bg-white p-4">
        <div className="grid gap-3 md:grid-cols-2">
          <p className="text-sm"><span className="font-semibold">Status:</span> {statusLabel(normalizedStatus)}</p>
          <p className="text-sm"><span className="font-semibold">Submitted:</span> {formatDateTime(quote.created_at)}</p>
          <p className="text-sm"><span className="font-semibold">Service:</span> {quote.service_title_snapshot ?? quote.service_category_snapshot ?? "General request"}</p>
          <p className="text-sm"><span className="font-semibold">Budget minimum:</span> ₦{Number(quote.budget_min ?? 0).toLocaleString()}</p>
          <p className="text-sm"><span className="font-semibold">Budget maximum:</span> ₦{Number(quote.budget_max ?? 0).toLocaleString()}</p>
        </div>
        <div className="mt-3 rounded-lg border bg-slate-50 p-3 text-sm text-slate-700">{quote.request_details ?? "No detailed request provided."}</div>
      </article>

      {(isPendingReview || isQuoted) && (
        <article className="rounded-xl border bg-white p-4">
          <h3 className="font-semibold">{isQuoted ? "Revise commercial offer" : "Send commercial offer"}</h3>
          <form action={quoteWorkflowAction} className="mt-4 grid gap-4 md:grid-cols-2">
            <input type="hidden" name="quote_id" value={quote.id} />
            <input type="hidden" name="action" value="send_quote" />
            <label className="text-sm">
              Quoted amount (₦)
              <input
                required
                name="quoted_amount"
                type="number"
                min={0.01}
                step={0.01}
                defaultValue={quote.quoted_amount ?? quote.budget_max ?? quote.budget_min ?? ""}
                className="mt-1 w-full rounded border px-3 py-2 text-sm"
              />
            </label>
            <label className="text-sm">
              Validity days
              <input
                required
                name="validity_days"
                type="number"
                min={1}
                max={365}
                step={1}
                defaultValue={quote.validity_days ?? 14}
                className="mt-1 w-full rounded border px-3 py-2 text-sm"
              />
            </label>
            <label className="text-sm md:col-span-2">
              Estimated timeline
              <input
                required
                name="estimated_timeline"
                defaultValue={quote.estimated_timeline ?? ""}
                className="mt-1 w-full rounded border px-3 py-2 text-sm"
                placeholder="e.g. 7 business days after confirmation"
              />
            </label>
            <label className="text-sm md:col-span-2">
              Provider response
              <textarea
                required
                name="provider_response_message"
                defaultValue={quote.provider_response_message ?? ""}
                className="mt-1 min-h-24 w-full rounded border px-3 py-2 text-sm"
                placeholder="Summarize the proposed solution, deliverables, and next step."
              />
            </label>
            <label className="text-sm md:col-span-2">
              Quote terms
              <textarea
                required
                name="quote_terms"
                defaultValue={quote.quote_terms ?? ""}
                className="mt-1 min-h-24 w-full rounded border px-3 py-2 text-sm"
                placeholder="Commercial terms, assumptions, exclusions, and VAT handling."
              />
            </label>
            <div className="md:col-span-2">
              <button className="rounded bg-indigo-900 px-4 py-2 text-sm font-semibold text-white">
                {isQuoted ? "Revise offer" : "Send offer"}
              </button>
            </div>
          </form>
        </article>
      )}

      {(isQuoted || isAccepted || isConverted) && (
        <article className="rounded-xl border bg-white p-4">
          <h3 className="font-semibold">Commercial offer</h3>
          <dl className="mt-3 grid gap-3 text-sm md:grid-cols-2">
            <div><dt className="font-semibold text-slate-900">Quoted amount</dt><dd>{formatNaira(quote.quoted_amount)}</dd></div>
            <div><dt className="font-semibold text-slate-900">Validity</dt><dd>{quote.validity_days ?? "—"} day{Number(quote.validity_days ?? 0) === 1 ? "" : "s"}</dd></div>
            <div><dt className="font-semibold text-slate-900">Timeline</dt><dd>{quote.estimated_timeline ?? "—"}</dd></div>
            <div><dt className="font-semibold text-slate-900">Sent</dt><dd>{formatDateTime(quote.quote_sent_at)}</dd></div>
          </dl>
          <div className="mt-3 rounded-lg border bg-slate-50 p-3 text-sm text-slate-700">{quote.provider_response_message ?? "No response message recorded."}</div>
          <div className="mt-3 rounded-lg border bg-slate-50 p-3 text-sm text-slate-700">{quote.quote_terms ?? "No terms recorded."}</div>
        </article>
      )}

      <div className="grid gap-3 rounded-xl border bg-white p-4 md:grid-cols-4">
        {isPendingReview && (
          <>
            <form action={quoteWorkflowAction}>
              <input type="hidden" name="quote_id" value={quote.id} />
              <input type="hidden" name="action" value="mark_reviewed" />
              <button className="w-full rounded border px-3 py-2 text-sm">Mark reviewed</button>
            </form>
            <form action={quoteWorkflowAction}>
              <input type="hidden" name="quote_id" value={quote.id} />
              <input type="hidden" name="action" value="decline" />
              <button className="w-full rounded border border-rose-300 px-3 py-2 text-sm text-rose-700">Decline quote</button>
            </form>
          </>
        )}

        {isQuoted && (
          <>
            <form action={quoteWorkflowAction}>
              <input type="hidden" name="quote_id" value={quote.id} />
              <input type="hidden" name="action" value="customer_accept" />
              <button className="w-full rounded bg-emerald-700 px-3 py-2 text-sm text-white">Record customer acceptance</button>
            </form>
            <form action={quoteWorkflowAction}>
              <input type="hidden" name="quote_id" value={quote.id} />
              <input type="hidden" name="action" value="decline" />
              <button className="w-full rounded border border-rose-300 px-3 py-2 text-sm text-rose-700">Decline quote</button>
            </form>
          </>
        )}

        {isAccepted && (
          <>
            <form action={quoteWorkflowAction}>
              <input type="hidden" name="quote_id" value={quote.id} />
              <input type="hidden" name="action" value="decline" />
              <button className="w-full rounded border border-rose-300 px-3 py-2 text-sm text-rose-700">Decline quote</button>
            </form>
            <form action={quoteWorkflowAction}>
              <input type="hidden" name="quote_id" value={quote.id} />
              <input type="hidden" name="action" value="convert_invoice" />
              <button className="w-full rounded bg-indigo-900 px-3 py-2 text-sm text-white">Convert to invoice</button>
            </form>
          </>
        )}

        {(isConverted || isDeclined) && (
          <p className="text-sm text-slate-600 md:col-span-4">
            {isConverted
              ? "No further quote actions are available because this quote is already converted."
              : "No further quote actions are available because this quote has been declined."}
          </p>
        )}
      </div>

      <article className="rounded-xl border bg-white p-4">
        <h3 className="font-semibold">Linked invoices</h3>
        <div className="mt-3 space-y-2">
          {linkedInvoices.length === 0 && <p className="text-sm text-slate-500">No invoices linked yet.</p>}
          {linkedInvoices.map((link: { invoice_id: string; created_at: string }) => (
            <p key={`${link.invoice_id}-${link.created_at}`} className="text-sm">
              <Link className="text-indigo-700 hover:underline" href={`/dashboard/msme/invoices/${link.invoice_id}`}>
                Invoice {link.invoice_id}
              </Link>{" "}
              linked on {new Date(link.created_at).toLocaleString("en-NG")}
            </p>
          ))}
        </div>
      </article>

      <article className="rounded-xl border bg-white p-4">
        <h3 className="font-semibold">Status history</h3>
        <div className="mt-3 space-y-2">
          {statusHistory.length === 0 && <p className="text-sm text-slate-500">No status history recorded yet.</p>}
          {statusHistory.map((entry) => (
            <div key={`${entry.to_status}-${entry.created_at}`} className="rounded-lg border bg-slate-50 px-3 py-2 text-sm">
              <p className="font-medium text-slate-800">
                {entry.from_status ? `${statusLabel(entry.from_status)} → ` : ""}
                {statusLabel(entry.to_status)}
              </p>
              <p className="text-xs text-slate-500">
                {formatDateTime(entry.created_at)} · {entry.changed_by_role ?? "system"}
                {entry.note ? ` · ${entry.note}` : ""}
              </p>
            </div>
          ))}
        </div>
      </article>
    </section>
  );
}
