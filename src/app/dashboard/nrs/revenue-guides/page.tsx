import { NrsWorkspacePage } from "@/components/nrs/nrs-formalisation-workspace";
import { getCurrentUserContext } from "@/lib/auth/session";
import { getNrsFormalisationWorkspace } from "@/lib/data/nrs-formalisation";

export default async function NrsRevenueGuidesPage() {
  const ctx = await getCurrentUserContext();
  const workspace = await getNrsFormalisationWorkspace(ctx);
  return <NrsWorkspacePage workspace={workspace} section="revenue-guides" />;
}
