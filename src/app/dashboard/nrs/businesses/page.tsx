import { NrsWorkspacePage } from "@/components/nrs/nrs-formalisation-workspace";
import { requireWorkspaceRole } from "@/lib/auth/workspace-guards";
import { NRS_ACCESS_ROLES } from "@/lib/nrs/access";
import { getNrsFormalisationWorkspace, normalizeNrsFilters } from "@/lib/data/nrs-formalisation";

export default async function NrsBusinessesPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const [ctx, rawSearchParams] = await Promise.all([requireWorkspaceRole([...NRS_ACCESS_ROLES], "/dashboard/nrs/businesses"), searchParams]);
  const workspace = await getNrsFormalisationWorkspace(ctx, normalizeNrsFilters(rawSearchParams));
  return <NrsWorkspacePage workspace={workspace} section="businesses" />;
}
