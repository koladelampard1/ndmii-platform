import { NrsWorkspacePage } from "@/components/nrs/nrs-formalisation-workspace";
import { getCurrentUserContext } from "@/lib/auth/session";
import { getNrsFormalisationWorkspace, normalizeNrsFilters } from "@/lib/data/nrs-formalisation";

export default async function NrsBusinessesPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const [ctx, rawSearchParams] = await Promise.all([getCurrentUserContext(), searchParams]);
  const workspace = await getNrsFormalisationWorkspace(ctx, normalizeNrsFilters(rawSearchParams));
  return <NrsWorkspacePage workspace={workspace} section="businesses" />;
}
