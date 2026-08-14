import { CorrespondenceTable, WorkspaceCard } from "@/app/dashboard/correspondence/_components";
import { getCorrespondenceRepresentativeAuthority, getCorrespondenceWorkspaceSnapshot, requireLcdboCorrespondenceAccess } from "@/lib/data/lcdbo-correspondence";
import { representativeBuckets } from "@/lib/lcdbo-correspondence/representative-workflow";

export default async function CorrespondenceSentPage() {
  const { ctx, programme, supabase } = await requireLcdboCorrespondenceAccess("view");
  const snapshot = await getCorrespondenceWorkspaceSnapshot(supabase);
  const authority = ctx.appUserId ? await getCorrespondenceRepresentativeAuthority({ actorUserId: ctx.appUserId, programmeId: programme.id, client: supabase }) : null;
  const records = authority
    ? representativeBuckets(snapshot.records, authority).sent
    : snapshot.records.filter((record) => ["sent", "delivery_failed", "delivered", "acknowledged", "response_received", "closed"].includes(record.status));

  return (
    <WorkspaceCard title="Sent letters" description="Issued correspondence, delivery exceptions, responses and closed records for your institution.">
      <CorrespondenceTable records={records} />
    </WorkspaceCard>
  );
}
