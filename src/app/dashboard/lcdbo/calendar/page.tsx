import { redirect } from "next/navigation";
import { CalendarAgenda } from "@/components/lcdbo/lcdbo-delivery-components";
import { WorkspacePage, WorkspacePageHeader, WorkspaceSection, WorkspaceState } from "@/components/workspace/workspace-page";
import { getLcdboDeliverySnapshot, requireLcdboDeliveryAccess } from "@/lib/data/lcdbo-delivery";

export const dynamic = "force-dynamic";

export default async function LcdboDeliveryCalendarPage() {
  const access = await requireLcdboDeliveryAccess("view").catch(() => null);
  if (!access) redirect("/access-denied");
  const snapshot = await getLcdboDeliverySnapshot(access.supabase);
  if (snapshot.unavailable) return <WorkspacePage><WorkspaceState type="not-configured" title="Delivery calendar unavailable" description="Apply the Sprint 1 delivery migration to enable scheduled commitments." /></WorkspacePage>;

  return (
    <WorkspacePage>
      <WorkspacePageHeader
        eyebrow="Programme Delivery"
        title="Delivery Calendar"
        description="A governed agenda generated from milestone due dates, deliverable deadlines, RAID review dates and decision deadlines."
        classification={{ classification: "operational", label: "Live operational" }}
        disclosure="This is an internal delivery agenda. External calendar integrations are intentionally out of scope for Sprint 1."
      />
      <WorkspaceSection title="Scheduled commitments" description="Sorted by date across programme delivery registers.">
        <CalendarAgenda items={snapshot.items} raids={snapshot.raids} decisions={snapshot.decisions} />
      </WorkspaceSection>
    </WorkspacePage>
  );
}
