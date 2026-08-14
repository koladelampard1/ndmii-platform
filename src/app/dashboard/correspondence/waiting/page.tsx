import { CorrespondenceTable, WorkspaceCard } from "@/app/dashboard/correspondence/_components";
import { getCorrespondenceRepresentativeAuthority, getCorrespondenceWorkspaceSnapshot, requireLcdboCorrespondenceAccess } from "@/lib/data/lcdbo-correspondence";
import { representativeBuckets } from "@/lib/lcdbo-correspondence/representative-workflow";

export default async function CorrespondenceWaitingPage() {
  const { ctx, programme, supabase } = await requireLcdboCorrespondenceAccess("view");
  const snapshot = await getCorrespondenceWorkspaceSnapshot(supabase);
  const authority = ctx.appUserId ? await getCorrespondenceRepresentativeAuthority({ actorUserId: ctx.appUserId, programmeId: programme.id, client: supabase }) : null;
  const records = authority
    ? representativeBuckets(snapshot.records, authority).waitingForOtherParty
    : snapshot.records.filter((record) => record.status === "awaiting_signature");

  return (
    <WorkspaceCard title="Waiting for other party" description="Letters your institution has signed and sent to the counterparty for review and countersignature.">
      <CorrespondenceTable records={records} />
    </WorkspaceCard>
  );
}
