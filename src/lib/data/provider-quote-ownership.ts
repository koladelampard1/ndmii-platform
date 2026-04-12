import type { ProviderWorkspaceContext } from "@/lib/data/provider-operations";

const OWNERSHIP_COLUMNS = ["provider_profile_id", "provider_id", "msme_id", "provider_msme_id"] as const;

type OwnershipColumn = (typeof OWNERSHIP_COLUMNS)[number];

type Comparable = string | null;

export type QuoteOwnershipResolution = {
  isOwned: boolean;
  isCheckable: boolean;
  matchReason: string;
  checks: Array<{
    check: string;
    quoteValue: Comparable;
    workspaceValue: Comparable;
    matched: boolean;
  }>;
  quoteKeys: Record<OwnershipColumn, Comparable>;
  workspaceKeys: {
    provider_id: Comparable;
    provider_msme_id: Comparable;
    workspace_msme_id: Comparable;
    workspace_msme_public_id: Comparable;
    linked_msme_id: Comparable;
    linked_provider_id: Comparable;
  };
};

export function isUuidLike(value: string | null | undefined) {
  if (!value) return false;
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value.trim());
}

function toComparableValue(value: unknown): Comparable {
  if (value === null || value === undefined) return null;
  const normalized = String(value).trim();
  return normalized.length > 0 ? normalized : null;
}

function valuesComparableForOwnership(left: Comparable, right: Comparable) {
  if (!left || !right) return false;
  const leftIsUuid = isUuidLike(left);
  const rightIsUuid = isUuidLike(right);
  if (leftIsUuid !== rightIsUuid) return false;
  return left === right;
}

function extractQuoteKeys(quote: Record<string, unknown>, quoteColumns?: Set<string>) {
  const hasColumn = (column: OwnershipColumn) => !quoteColumns || quoteColumns.has(column);
  return {
    provider_profile_id: hasColumn("provider_profile_id") ? toComparableValue(quote.provider_profile_id) : null,
    provider_id: hasColumn("provider_id") ? toComparableValue(quote.provider_id) : null,
    msme_id: hasColumn("msme_id") ? toComparableValue(quote.msme_id) : null,
    provider_msme_id: hasColumn("provider_msme_id") ? toComparableValue(quote.provider_msme_id) : null,
  };
}

function extractWorkspaceKeys(
  workspace: ProviderWorkspaceContext,
  options?: {
    linkedMsmeId?: string | null;
    linkedProviderId?: string | null;
  }
) {
  return {
    provider_id: toComparableValue(workspace.provider.id),
    provider_msme_id: toComparableValue(workspace.provider.msme_id),
    workspace_msme_id: toComparableValue(workspace.msme.id),
    workspace_msme_public_id: toComparableValue(workspace.msme.msme_id),
    linked_msme_id: toComparableValue(options?.linkedMsmeId ?? null),
    linked_provider_id: toComparableValue(options?.linkedProviderId ?? null),
  };
}

export function resolveProviderQuoteOwnership(
  quote: Record<string, unknown>,
  workspace: ProviderWorkspaceContext,
  options?: {
    quoteColumns?: Set<string>;
    linkedMsmeId?: string | null;
    linkedProviderId?: string | null;
  }
): QuoteOwnershipResolution {
  const quoteKeys = extractQuoteKeys(quote, options?.quoteColumns);
  const workspaceKeys = extractWorkspaceKeys(workspace, {
    linkedMsmeId: options?.linkedMsmeId ?? null,
    linkedProviderId: options?.linkedProviderId ?? null,
  });

  const checks: QuoteOwnershipResolution["checks"] = [];
  const runCheck = (check: string, quoteValue: Comparable, workspaceValue: Comparable) => {
    const matched = valuesComparableForOwnership(quoteValue, workspaceValue);
    checks.push({ check, quoteValue, workspaceValue, matched });
  };

  runCheck("provider_profile_id === workspace.provider.id", quoteKeys.provider_profile_id, workspaceKeys.provider_id);
  runCheck("provider_id === workspace.provider.id", quoteKeys.provider_id, workspaceKeys.provider_id);
  runCheck("provider_profile_id === linked_provider_id", quoteKeys.provider_profile_id, workspaceKeys.linked_provider_id);
  runCheck("provider_id === linked_provider_id", quoteKeys.provider_id, workspaceKeys.linked_provider_id);

  runCheck("msme_id === workspace.provider.msme_id", quoteKeys.msme_id, workspaceKeys.provider_msme_id);
  runCheck("provider_msme_id === workspace.provider.msme_id", quoteKeys.provider_msme_id, workspaceKeys.provider_msme_id);
  runCheck("msme_id === workspace.msme.msme_id", quoteKeys.msme_id, workspaceKeys.workspace_msme_public_id);
  runCheck("provider_msme_id === workspace.msme.msme_id", quoteKeys.provider_msme_id, workspaceKeys.workspace_msme_public_id);
  runCheck("msme_id === workspace.msme.id", quoteKeys.msme_id, workspaceKeys.workspace_msme_id);
  runCheck("provider_msme_id === workspace.msme.id", quoteKeys.provider_msme_id, workspaceKeys.workspace_msme_id);
  runCheck("msme_id === linked_msme_id", quoteKeys.msme_id, workspaceKeys.linked_msme_id);
  runCheck("provider_msme_id === linked_msme_id", quoteKeys.provider_msme_id, workspaceKeys.linked_msme_id);

  const matchedCheck = checks.find((check) => check.matched);
  const quoteHasOwnershipKey = Object.values(quoteKeys).some(Boolean);
  const workspaceHasOwnershipKey = Object.values(workspaceKeys).some(Boolean);

  return {
    isOwned: Boolean(matchedCheck),
    isCheckable: quoteHasOwnershipKey && workspaceHasOwnershipKey,
    matchReason: matchedCheck?.check ?? "no_ownership_match",
    checks,
    quoteKeys,
    workspaceKeys,
  };
}

export function getOwnedProviderQuoteIdsForWorkspace(
  quotes: Array<Record<string, unknown>>,
  workspace: ProviderWorkspaceContext,
  options?: {
    quoteColumns?: Set<string>;
    linkedMsmeId?: string | null;
    linkedProviderId?: string | null;
  }
) {
  const ownedIds = new Set<string>();
  const resolutionByQuoteId = new Map<string, QuoteOwnershipResolution>();

  for (const quote of quotes) {
    const quoteId = toComparableValue(quote.id);
    if (!quoteId) continue;
    const resolution = resolveProviderQuoteOwnership(quote, workspace, options);
    resolutionByQuoteId.set(quoteId, resolution);
    if (resolution.isOwned) {
      ownedIds.add(quoteId);
    }
  }

  return { ownedIds, resolutionByQuoteId };
}

export function getProviderQuoteOwnershipColumns(quoteColumns: Set<string>) {
  return OWNERSHIP_COLUMNS.filter((column) => quoteColumns.has(column));
}
