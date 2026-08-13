import { getCorrespondenceWorkspaceSnapshot, requireLcdboCorrespondenceAccess } from "@/lib/data/lcdbo-correspondence";
import { CorrespondenceTable, WorkspaceCard } from "@/app/dashboard/correspondence/_components";

export default async function CorrespondenceMyWorkPage() {
  const { ctx, supabase } = await requireLcdboCorrespondenceAccess("view");
  const snapshot = await getCorrespondenceWorkspaceSnapshot(supabase);
  const myRecords = snapshot.records.filter((record) => [record.owner_id, record.requester_id, record.drafter_id, record.current_assignee_id].includes(ctx.appUserId));
  return <WorkspaceCard title="My correspondence work" description="Records assigned to you or created by you."><CorrespondenceTable records={myRecords} /></WorkspaceCard>;
}
