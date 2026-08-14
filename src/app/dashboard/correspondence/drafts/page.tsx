import { getCorrespondenceRepresentativeAuthority, getCorrespondenceWorkspaceSnapshot, requireLcdboCorrespondenceAccess } from "@/lib/data/lcdbo-correspondence";
import { CorrespondenceTable, WorkspaceCard } from "@/app/dashboard/correspondence/_components";
import { representativeBuckets } from "@/lib/lcdbo-correspondence/representative-workflow";

export default async function CorrespondenceDraftsPage() {
  const { ctx, programme, supabase } = await requireLcdboCorrespondenceAccess("draft");
  const snapshot = await getCorrespondenceWorkspaceSnapshot(supabase);
  const authority = ctx.appUserId ? await getCorrespondenceRepresentativeAuthority({ actorUserId: ctx.appUserId, programmeId: programme.id, client: supabase }) : null;
  const records = authority
    ? representativeBuckets(snapshot.records, authority).drafts
    : snapshot.records.filter((record) => ["draft", "revision_requested"].includes(record.status));
  return <WorkspaceCard title="Drafts" description="Letters your institution can still complete before sending to the other party."><CorrespondenceTable records={records} /></WorkspaceCard>;
}
