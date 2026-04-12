import Link from "next/link";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { getCurrentUserContext } from "@/lib/auth/session";
import { getProviderWorkspaceContext } from "@/lib/data/provider-operations";
import { calculateLineTotal, generateInvoiceNumber } from "@/lib/data/invoicing";
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

function devQuoteLog(message: string, payload: Record<string, unknown>) {
  if (!DEV_MODE) return;
  console.info(`[quote-workflow] ${message}`, payload);
}

function isUuidLike(value: string | null | undefined) {
  if (!value) return false;
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value.trim());
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

function toComparableValue(value: unknown) {
  if (value === null || value === undefined) return null;
  const normalized = String(value).trim();
  return normalized.length > 0 ? normalized : null;
}

function valuesComparableForOwnership(left: string | null, right: string | null) {
  if (!left || !right) return false;
  const leftIsUuid = isUuidLike(left);
  const rightIsUuid = isUuidLike(right);
  if (leftIsUuid !== rightIsUuid) return false;
  return left === right;
}

type QuoteOwnershipResolution = {
  isOwned: boolean;
  matchReason: string;
  checks: Array<{
    check: string;
    quoteValue: string | null;
    workspaceValue: string | null;
    matched: boolean;
  }>;
  quoteKeys: Record<string, string | null>;
  workspaceKeys: Record<string, string | null>;
};

function resolveQuoteOwnership(
  quote: Record<string, unknown>,
  quoteColumns: Set<string>,
  workspace: Awaited<ReturnType<typeof getProviderWorkspaceContext>>,
  options?: { linkedMsmeId?: string | null }
) {
  const quoteKeys = {
    provider_profile_id: quoteColumns.has("provider_profile_id") ? toComparableValue(quote.provider_profile_id) : null,
    provider_id: quoteColumns.has("provider_id") ? toComparableValue(quote.provider_id) : null,
    msme_id: quoteColumns.has("msme_id") ? toComparableValue(quote.msme_id) : null,
    provider_msme_id: quoteColumns.has("provider_msme_id") ? toComparableValue(quote.provider_msme_id) : null,
  };
  const workspaceKeys = {
    provider_id: toComparableValue(workspace.provider.id),
    provider_msme_id: toComparableValue(workspace.provider.msme_id),
    provider_public_slug: toComparableValue((workspace.provider as { public_slug?: string | null }).public_slug),
    linked_msme_id: toComparableValue(options?.linkedMsmeId ?? null),
    workspace_msme_id: toComparableValue(workspace.msme.id),
    workspace_msme_public_id: toComparableValue(workspace.msme.msme_id),
  };

  const checks: QuoteOwnershipResolution["checks"] = [];
  const runCheck = (check: string, quoteValue: string | null, workspaceValue: string | null) => {
    const matched = valuesComparableForOwnership(quoteValue, workspaceValue);
    checks.push({ check, quoteValue, workspaceValue, matched });
  };

  runCheck("provider_profile_id === workspace.provider.id", quoteKeys.provider_profile_id, workspaceKeys.provider_id);
  runCheck("provider_id === workspace.provider.id", quoteKeys.provider_id, workspaceKeys.provider_id);
  runCheck("msme_id === workspace.provider.msme_id", quoteKeys.msme_id, workspaceKeys.provider_msme_id);
  runCheck("provider_msme_id === workspace.provider.msme_id", quoteKeys.provider_msme_id, workspaceKeys.provider_msme_id);

  if (workspaceKeys.linked_msme_id) {
    const quoteMsmeColumns = [
      { column: "msme_id", value: quoteKeys.msme_id },
      { column: "provider_msme_id", value: quoteKeys.provider_msme_id },
    ];
    for (const quoteMsmeColumn of quoteMsmeColumns) {
      if (!quoteMsmeColumn.value) continue;
      if (!isUuidLike(quoteMsmeColumn.value)) continue;
      runCheck(`${quoteMsmeColumn.column} (uuid) === linkedMsmeId`, quoteMsmeColumn.value, workspaceKeys.linked_msme_id);
    }
  }

  if (workspaceKeys.workspace_msme_id) {
    const quoteMsmeColumns = [
      { column: "msme_id", value: quoteKeys.msme_id },
      { column: "provider_msme_id", value: quoteKeys.provider_msme_id },
    ];
    for (const quoteMsmeColumn of quoteMsmeColumns) {
      if (!quoteMsmeColumn.value) continue;
      if (!isUuidLike(quoteMsmeColumn.value)) continue;
      runCheck(`${quoteMsmeColumn.column} (uuid) === workspace.msme.id`, quoteMsmeColumn.value, workspaceKeys.workspace_msme_id);
    }
  }

  const matchedCheck = checks.find((check) => check.matched);

  return {
    isOwned: Boolean(matchedCheck),
    matchReason: matchedCheck?.check ?? "no_ownership_match",
    checks,
    quoteKeys,
    workspaceKeys,
  };
}

async function loadQuoteForCurrentProvider(
  supabase: Awaited<ReturnType<typeof createServiceRoleSupabaseClient>>,
  workspace: Awaited<ReturnType<typeof getProviderWorkspaceContext>>,
  quoteId: string,
  requiredSelectFields: string[]
): Promise<{ quote: any; quoteColumns: Set<string> }> {
  const currentUser = await getCurrentUserContext();
  const quoteColumns = await getTableColumns(supabase, "provider_quotes");
  const ownershipColumns = ["provider_profile_id", "provider_id", "msme_id", "provider_msme_id"].filter((column) => quoteColumns.has(column));
  const selectFields = Array.from(new Set([...requiredSelectFields, ...ownershipColumns]));
  const selectClause = selectFields.join(",");

  devQuoteLog("[quote-ownership] quote_load:context", {
    quoteId,
    workspace: {
      provider: {
        id: workspace.provider.id,
        msme_id: workspace.provider.msme_id ?? null,
        public_slug: (workspace.provider as { public_slug?: string | null }).public_slug ?? null,
      },
      msme: {
        id: workspace.msme.id ?? null,
        msme_id: workspace.msme.msme_id ?? null,
      },
      linkedMsmeId: currentUser.linkedMsmeId ?? null,
    },
    available_provider_quotes_columns: Array.from(quoteColumns).sort(),
  });

  const idProbeSelect = ownershipColumns.length > 0 ? `id,${ownershipColumns.join(",")}` : "id";
  const { data: quoteByIdOnly, error: quoteByIdOnlyError }: { data: any; error: any } = await supabase
    .from("provider_quotes")
    .select(idProbeSelect)
    .eq("id", quoteId)
    .maybeSingle();

  devQuoteLog("[quote-ownership] quote_load:id_probe", {
    quoteId,
    exists_by_id_only: Boolean(quoteByIdOnly),
    id_probe_error: quoteByIdOnlyError?.message ?? null,
    quote_row: quoteByIdOnly ?? null,
  });

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

  const ownership = resolveQuoteOwnership((quote ?? {}) as Record<string, unknown>, quoteColumns, workspace, {
    linkedMsmeId: currentUser.linkedMsmeId ?? null,
  });
  devQuoteLog("[quote-ownership] summary", {
    quoteId,
    matched: ownership.isOwned,
    matchReason: ownership.matchReason,
    quoteKeys: ownership.quoteKeys,
    workspaceKeys: ownership.workspaceKeys,
    checks: ownership.checks,
    quoteRow: quote,
    quoteColumns: Array.from(quoteColumns).sort(),
  });

  if (!ownership.isOwned) {
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
  providerMsmeId: string | null,
  previousStatus: string,
  nextStatus: "in_review" | "accepted" | "declined" | "converted",
  lifecycleColumn?: "reviewed_at" | "accepted_at" | "declined_at"
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
    providerMsmeId,
    previousStatus,
    nextStatus,
    lifecycleColumn: lifecycleColumn ?? null,
    updatePayload: payload,
    update_scope: "id_only_after_prevalidated_ownership",
  });

  let updateQuery = supabase.from("provider_quotes").update(payload).eq("id", quoteId);

  const { data: updatedQuote, error } = updateSelect.length
    ? await updateQuery.select(updateSelect.join(",")).maybeSingle()
    : await updateQuery.select("id,status").maybeSingle();

  if (error) {
    devQuoteLog("update:error", {
      quoteId,
      providerId,
      previousStatus,
      nextStatus,
      code: error.code ?? null,
      details: error.details ?? null,
      hint: error.hint ?? null,
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
      previousStatus,
      nextStatus,
      message: readBackError.message,
      code: readBackError.code ?? null,
    });
    throw new Error(`Quote status read-back failed: ${readBackError.message}`);
  }

  devQuoteLog("update:result", {
    quoteId,
    providerId,
    previousStatus,
    nextStatus,
    updatePayload: payload,
    returnedRow: updatedQuote ?? null,
    readBackRow: readBackRow ?? null,
  });

  if (!readBackRow) {
    throw new Error("Quote status update failed: quote row not found after update.");
  }

  const readBackStatus = String((readBackRow as { status?: string | null }).status ?? "").toLowerCase();
  if (readBackStatus !== nextStatus) {
    devQuoteLog("update:status_mismatch", {
      quoteId,
      providerId,
      previousStatus,
      nextStatus,
      readBackStatus,
      diagnostics: [
        "possible_wrong_filter_or_quote_id",
        "possible_provider_profile_mismatch",
        "possible_rls_or_permissions_mismatch",
        "possible_stale_or_non_updating_query",
      ],
    });
    throw new Error(`Quote status update mismatch: expected ${nextStatus} but got ${readBackStatus || "empty"}.`);
  }

  return readBackRow;
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
    "request_summary",
    "request_details",
    "requester_name",
    "requester_email",
    "requester_phone",
    "budget_min",
    "budget_max",
  ];
  const { quote } = await loadQuoteForCurrentProvider(supabase, workspace, quoteId, quoteSelectFields);

  if (action === "mark_reviewed") {
    await updateQuoteStatus(supabase, quote.id, workspace.provider.id, workspace.provider.msme_id ?? null, String(quote.status ?? ""), "in_review", "reviewed_at");
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

  if (action === "accept") {
    const updatedRow = await updateQuoteStatus(supabase, quote.id, workspace.provider.id, workspace.provider.msme_id ?? null, String(quote.status ?? ""), "accepted", "accepted_at");
    devQuoteLog("accept:verified_status", {
      quoteId: quote.id,
      oldStatus: String(quote.status ?? ""),
      renderedStatus: String((updatedRow as { status?: string | null }).status ?? ""),
    });
    await logActivityEvent(supabase, {
      action: "quote_accepted",
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
    await updateQuoteStatus(supabase, quote.id, workspace.provider.id, workspace.provider.msme_id ?? null, String(quote.status ?? ""), "declined", "declined_at");
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
    const normalizedQuoteStatus = String(quote.status ?? "").toLowerCase();
    const canConvert = normalizedQuoteStatus === "accepted";
    devQuoteLog("convert:gate", {
      quoteId: quote.id,
      renderedStatus: String(quote.status ?? ""),
      normalizedStatus: normalizedQuoteStatus,
      canConvert,
    });
    if (!canConvert) {
      redirect(`/dashboard/msme/quotes/${quote.id}?error=quote_not_accepted`);
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
        requester_name: quote.requester_name,
        requester_email: quote.requester_email,
        requester_phone: quote.requester_phone,
        request_summary: quote.request_summary,
        budget_min: quote.budget_min,
        budget_max: quote.budget_max,
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
    const availableInvoicesColumns = Array.from(availableInvoicesColumnsSet).sort();
    const quoteSummary = String(quote.request_summary ?? "").trim();
    const quoteDetails = String(quote.request_details ?? "").trim();
    const invoiceNotes = [quoteSummary, quoteDetails].filter(Boolean).join(" — ");
    const rawInvoicePayload = {
      provider_profile_id: workspace.provider.id,
      msme_id: resolvedMsmeUuid,
      invoice_number: generateInvoiceNumber(),
      customer_name: quote.requester_name,
      customer_email: quote.requester_email,
      customer_phone: quote.requester_phone,
      title: quoteSummary || `Quote ${quote.id}`,
      notes: invoiceNotes || null,
      currency: "NGN",
      vat_rate: 7.5,
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
      invoiceInsertPayload: finalInvoiceInsertPayload,
      availableInvoicesColumns,
      rawInvoicePayload,
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
            details: invoiceInsertError.details ?? null,
            hint: invoiceInsertError.hint ?? null,
          }
        : null,
      invoiceInsertData,
    });
    if (invoiceInsertError || !invoiceInsertData) throw new Error(`Invoice creation from quote failed: ${invoiceInsertError?.message ?? "unknown"}`);

    const itemColumns = await getTableColumns(supabase, "invoice_items");
    const seededAmount = Number(quote.budget_max ?? quote.budget_min ?? 0);
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
          details: linkError.details ?? null,
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

    await updateQuoteStatus(supabase, quote.id, workspace.provider.id, workspace.provider.msme_id ?? null, String(quote.status ?? ""), "converted");

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
    "requester_name",
    "requester_email",
    "requester_phone",
    "request_summary",
    "request_details",
    "budget_min",
    "budget_max",
    "status",
    "created_at",
  ];
  const quotePromise = loadQuoteForCurrentProvider(supabase, workspace, quoteId, quoteSelectFields);

  const invoiceColumns = await getTableColumns(supabase, "invoices");
  const canQueryInvoiceQuoteId = invoiceColumns.has("quote_id");
  const [{ quote }, { data: links, error: linkError }, { data: linkedByQuoteId, error: quoteIdLinkError }] = await Promise.all([
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

  const normalizedStatus = String(quote.status ?? "").toLowerCase();
  const linkedInvoiceCount = linkedInvoices.length;
  const isConverted = normalizedStatus === "converted";
  const isAccepted = normalizedStatus === "accepted";
  const isDeclined = normalizedStatus === "declined";
  const isPendingReview = ["new", "submitted", "pending_reviewed", "in_review"].includes(normalizedStatus);
  const uiBranch = isConverted ? "converted" : isAccepted ? "accepted" : isDeclined ? "declined" : isPendingReview ? "pending" : "other";
  const showNotAcceptedWarning = query.error === "quote_not_accepted" && !isAccepted && !isConverted;

  console.info("[quote-detail:ui-state]", {
    quoteId: quote.id,
    status: quote.status,
    renderedStatus: normalizedStatus,
    linkedInvoiceCount,
    uiBranch,
    canConvertToInvoice: isAccepted,
  });

  return (
    <section className="space-y-4">
      <header className="rounded-xl border bg-white p-4">
        <p className="text-xs uppercase tracking-wide text-slate-500">Quote request</p>
        <h2 className="text-xl font-semibold">{quote.request_summary}</h2>
        <p className="text-sm text-slate-600">{quote.requester_name} · {quote.requester_email ?? quote.requester_phone ?? "No contact provided"}</p>
      </header>

      {query.saved && <p className="rounded border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-700">Quote action saved.</p>}
      {showNotAcceptedWarning && (
        <p className="rounded border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">Only accepted quotes can be converted into invoices.</p>
      )}
      {isConverted && (
        <p className="rounded border border-indigo-200 bg-indigo-50 px-3 py-2 text-sm text-indigo-700">This quote has already been converted into an invoice.</p>
      )}

      <article className="rounded-xl border bg-white p-4">
        <div className="grid gap-3 md:grid-cols-2">
          <p className="text-sm"><span className="font-semibold">Status:</span> {quote.status}</p>
          <p className="text-sm"><span className="font-semibold">Submitted:</span> {new Date(quote.created_at).toLocaleString("en-NG")}</p>
          <p className="text-sm"><span className="font-semibold">Budget minimum:</span> ₦{Number(quote.budget_min ?? 0).toLocaleString()}</p>
          <p className="text-sm"><span className="font-semibold">Budget maximum:</span> ₦{Number(quote.budget_max ?? 0).toLocaleString()}</p>
        </div>
        <div className="mt-3 rounded-lg border bg-slate-50 p-3 text-sm text-slate-700">{quote.request_details ?? "No detailed request provided."}</div>
      </article>

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
              <input type="hidden" name="action" value="accept" />
              <button className="w-full rounded bg-emerald-700 px-3 py-2 text-sm text-white">Accept quote</button>
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
    </section>
  );
}
