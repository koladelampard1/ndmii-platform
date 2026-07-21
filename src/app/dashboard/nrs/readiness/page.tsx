import { NrsWorkspacePage } from "@/components/nrs/nrs-formalisation-workspace";
import { requireWorkspaceRole } from "@/lib/auth/workspace-guards";
import { NRS_ACCESS_ROLES } from "@/lib/nrs/access";
import { getNrsFormalisationWorkspace } from "@/lib/data/nrs-formalisation";

export default async function NrsReadinessPage() {
  const ctx = await requireWorkspaceRole([...NRS_ACCESS_ROLES], "/dashboard/nrs");
  const workspace = await getNrsFormalisationWorkspace(ctx);
  return <NrsWorkspacePage workspace={workspace} section="readiness" />;
}
