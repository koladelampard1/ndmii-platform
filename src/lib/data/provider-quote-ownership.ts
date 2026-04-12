import type { ProviderWorkspaceContext } from "@/lib/data/provider-operations";

const OWNERSHIP_COLUMNS = ["provider_profile_id"] as const;

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
