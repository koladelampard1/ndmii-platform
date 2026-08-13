import { getCorrespondenceWorkspaceSnapshot, requireLcdboCorrespondenceAccess } from "@/lib/data/lcdbo-correspondence";
import { CorrespondenceTable, WorkspaceCard } from "@/app/dashboard/correspondence/_components";

export default async function CorrespondenceReviewPage() {
  const { supabase } = await requireLcdboCorrespondenceAccess("review");
  const snapshot = await getCorrespondenceWorkspaceSnapshot(supabase);
  return <WorkspaceCard title="Review screen" description="Correspondence submitted for RMRDC, Roseate or joint-secretariat review."><CorrespondenceTable records={snapshot.records.filter((record) => record.status === "in_review")} /></WorkspaceCard>;
}
