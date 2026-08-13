import { getCorrespondenceWorkspaceSnapshot, requireLcdboCorrespondenceAccess } from "@/lib/data/lcdbo-correspondence";
import { CorrespondenceTable, WorkspaceCard } from "@/app/dashboard/correspondence/_components";

export default async function CorrespondenceSignaturesPage() {
  const { supabase } = await requireLcdboCorrespondenceAccess("sign");
  const snapshot = await getCorrespondenceWorkspaceSnapshot(supabase);
  return <WorkspaceCard title="Signature queue" description="Approved records awaiting protected signature event."><CorrespondenceTable records={snapshot.records.filter((record) => record.status === "awaiting_signature")} /></WorkspaceCard>;
}
