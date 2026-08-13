import { getCorrespondenceWorkspaceSnapshot, requireLcdboCorrespondenceAccess } from "@/lib/data/lcdbo-correspondence";
import { CorrespondenceTable, WorkspaceCard } from "@/app/dashboard/correspondence/_components";

export default async function CorrespondencePreviewPage() {
  const { supabase } = await requireLcdboCorrespondenceAccess("view");
  const snapshot = await getCorrespondenceWorkspaceSnapshot(supabase);
  return <WorkspaceCard title="Document preview" description="Open draft PDFs to inspect layout, watermark, document fingerprint and verification furniture."><CorrespondenceTable records={snapshot.records} /></WorkspaceCard>;
}
