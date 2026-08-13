import { getCorrespondenceWorkspaceSnapshot, requireLcdboCorrespondenceAccess } from "@/lib/data/lcdbo-correspondence";
import { CorrespondenceTable, WorkspaceCard } from "@/app/dashboard/correspondence/_components";

export default async function CorrespondenceDraftsPage() {
  const { supabase } = await requireLcdboCorrespondenceAccess("draft");
  const snapshot = await getCorrespondenceWorkspaceSnapshot(supabase);
  return <WorkspaceCard title="Draft workspace" description="Draft and revision-requested correspondence records that can still be edited before review."><CorrespondenceTable records={snapshot.records.filter((record) => ["draft", "revision_requested"].includes(record.status))} /></WorkspaceCard>;
}
