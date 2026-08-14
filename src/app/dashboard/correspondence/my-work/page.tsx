import { getCorrespondenceRepresentativeAuthority, getCorrespondenceWorkspaceSnapshot, requireLcdboCorrespondenceAccess } from "@/lib/data/lcdbo-correspondence";
import { CorrespondenceTable, WorkspaceCard } from "@/app/dashboard/correspondence/_components";
import { representativeBuckets } from "@/lib/lcdbo-correspondence/representative-workflow";

export default async function CorrespondenceMyWorkPage() {
  const { ctx, programme, supabase } = await requireLcdboCorrespondenceAccess("view");
  const snapshot = await getCorrespondenceWorkspaceSnapshot(supabase);
  const authority = ctx.appUserId ? await getCorrespondenceRepresentativeAuthority({ actorUserId: ctx.appUserId, programmeId: programme.id, client: supabase }) : null;
  const buckets = representativeBuckets(snapshot.records, authority);
  const myRecords = authority
    ? buckets.needsMyAction
    : snapshot.records.filter((record) => [record.owner_id, record.requester_id, record.drafter_id, record.current_assignee_id].includes(ctx.appUserId));
  return <WorkspaceCard title="Needs my action" description="Letters waiting for your institution to review, countersign, correct or complete."><CorrespondenceTable records={myRecords} /></WorkspaceCard>;
}
