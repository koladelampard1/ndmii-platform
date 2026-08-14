import { CorrespondenceTable, WorkspaceCard } from "@/app/dashboard/correspondence/_components";
import { getCorrespondenceRepresentativeAuthority, getCorrespondenceWorkspaceSnapshot, requireLcdboCorrespondenceAccess } from "@/lib/data/lcdbo-correspondence";
import { representativeBuckets } from "@/lib/lcdbo-correspondence/representative-workflow";

export default async function CorrespondenceReadyToSendPage() {
  const { ctx, programme, supabase } = await requireLcdboCorrespondenceAccess("dispatch");
  const snapshot = await getCorrespondenceWorkspaceSnapshot(supabase);
  const authority = ctx.appUserId ? await getCorrespondenceRepresentativeAuthority({ actorUserId: ctx.appUserId, programmeId: programme.id, client: supabase }) : null;
  const records = authority
    ? representativeBuckets(snapshot.records, authority).readyToSend
    : snapshot.records.filter((record) => ["ready_for_dispatch", "dispatch_failed"].includes(record.status));

  return (
    <WorkspaceCard title="Ready to send" description="Letters with both institutional signatures and a generated final record, ready for initiating-party dispatch.">
      <CorrespondenceTable records={records} />
    </WorkspaceCard>
  );
}
