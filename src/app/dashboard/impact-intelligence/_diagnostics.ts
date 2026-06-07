import type { UserContext } from "@/lib/auth/authorization";

export function logImpactRouteDiagnostic({
  ctx,
  route,
  operation,
  error,
}: {
  ctx: UserContext | null;
  route: string;
  operation: string;
  error: unknown;
}) {
  console.warn("[impact-intelligence-route]", {
    role: ctx?.role ?? null,
    authUserId: ctx?.authUserId ?? null,
    appUserId: ctx?.appUserId ?? null,
    route,
    module: "impact-intelligence",
    operation,
    errorMessage: error instanceof Error ? error.message : "Unknown error",
  });
}
