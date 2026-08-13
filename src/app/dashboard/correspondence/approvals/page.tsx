import { getCorrespondenceWorkspaceSnapshot, requireLcdboCorrespondenceAccess } from "@/lib/data/lcdbo-correspondence";
import { CorrespondenceTable, WorkspaceCard } from "@/app/dashboard/correspondence/_components";

export default async function CorrespondenceApprovalsPage() {
  const { supabase } = await requireLcdboCorrespondenceAccess("approve");
  const snapshot = await getCorrespondenceWorkspaceSnapshot(supabase);
  return <WorkspaceCard title="Approval screen" description="Records awaiting required RMRDC/Roseate or joint-secretariat approval decisions."><CorrespondenceTable records={snapshot.records.filter((record) => record.status === "awaiting_approval")} /></WorkspaceCard>;
}
