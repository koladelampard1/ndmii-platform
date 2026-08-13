import { getCorrespondenceWorkspaceSnapshot, requireLcdboCorrespondenceAccess } from "@/lib/data/lcdbo-correspondence";
import { CorrespondenceTable, WorkspaceCard } from "@/app/dashboard/correspondence/_components";

export default async function CorrespondenceVersionsPage() {
  const { supabase } = await requireLcdboCorrespondenceAccess("view");
  const snapshot = await getCorrespondenceWorkspaceSnapshot(supabase);
  return <WorkspaceCard title="Version history" description="Review active records and open details to inspect immutable document versions and approval-bound hashes."><CorrespondenceTable records={snapshot.records} /></WorkspaceCard>;
}
