import Link from "next/link";
import { AlertTriangle, CheckCircle2, Clock3, MapPinned, XCircle, type LucideIcon } from "lucide-react";
import { getRegistryOperationsContext } from "@/app/dashboard/property/operations/_context";
import { loadGisWorkbench } from "@/lib/property/property-gis-service";
import { RegistryMetric, RegistryOperationsHero } from "@/components/property/property-operations-workspace";
import { GeometryPreview } from "@/components/property/property-gis-tools";
import { PropertyStatusBadge } from "@/components/property/property-workspace";

export const dynamic = "force-dynamic";

export default async function PropertyGisWorkbenchPage() {
  const { ctx, supabase } = await getRegistryOperationsContext();
  const workbench = await loadGisWorkbench({ client: supabase, ctx });

  return (
    <main className="space-y-6">
      <RegistryOperationsHero
        eyebrow="GIS operations"
        title="Registry GIS Workbench"
        description="Review submitted geometry, boundary metadata, survey references and potential overlap warnings. This is intentionally lightweight and does not include national intelligence dashboards."
        actions={[
          { href: "/dashboard/property/operations", label: "Command Centre" },
          { href: "/dashboard/property/cases", label: "Registry Cases" },
        ]}
      />

      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <RegistryMetric label="Submitted geometry" value={workbench.metrics.submitted} detail="Boundaries awaiting registry GIS review." />
        <RegistryMetric label="Verified geometry" value={workbench.metrics.verified} detail="Boundaries accepted by registry officers." />
        <RegistryMetric label="Rejected geometry" value={workbench.metrics.rejected} detail="Boundaries needing applicant correction." tone="rose" />
        <RegistryMetric label="Overlap warnings" value={workbench.metrics.overlapWarnings} detail="Bounding-box conflicts requiring review." tone="amber" />
      </section>

      <section className="grid gap-5">
        {workbench.geometries.map((geometry) => {
          const property = geometry.properties;
          const overlaps = workbench.overlapByGeometry.get(geometry.id) ?? [];
          return (
            <article key={geometry.id} className="grid gap-5 rounded-3xl border border-slate-200 bg-white p-5 shadow-sm xl:grid-cols-[0.8fr_1.2fr]">
              <GeometryPreview geometry={geometry} />
              <div>
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <p className="text-xs font-black uppercase tracking-[0.14em] text-[#008751]">{property?.npin ?? property?.application_reference ?? "Pending NPIN"}</p>
                    <h2 className="mt-2 text-2xl font-black text-[#06172f]">{property?.title || property?.property_type?.replaceAll("_", " ") || "Property geometry"}</h2>
                  </div>
                  <PropertyStatusBadge status={geometry.verification_status} />
                </div>
                <div className="mt-4 grid gap-3 md:grid-cols-3">
                  <MiniMetric icon={MapPinned} label="Source" value={geometry.source.replaceAll("_", " ")} />
                  <MiniMetric icon={Clock3} label="Captured" value={new Date(geometry.captured_at).toLocaleDateString("en-NG")} />
                  <MiniMetric icon={CheckCircle2} label="Privacy" value={geometry.privacy_visibility.replaceAll("_", " ")} />
                </div>
                {overlaps.length ? (
                  <div className="mt-4 rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm font-bold text-amber-900">
                    <AlertTriangle className="mr-2 inline h-4 w-4" />
                    Potential boundary overlap detected. Registry review required.
                  </div>
                ) : null}
                {geometry.verification_status === "rejected" ? (
                  <div className="mt-4 rounded-2xl border border-rose-200 bg-rose-50 p-4 text-sm font-bold text-rose-800">
                    <XCircle className="mr-2 inline h-4 w-4" />
                    Boundary rejected. Applicant correction may be required.
                  </div>
                ) : null}
                <div className="mt-5 flex flex-wrap gap-2">
                  <Link href="/dashboard/property/cases" className="rounded-xl bg-[#06172f] px-4 py-2 text-sm font-black text-white">Open cases</Link>
                </div>
              </div>
            </article>
          );
        })}
        {!workbench.geometries.length ? (
          <div className="rounded-[2rem] border border-dashed border-slate-300 bg-white p-10 text-center">
            <MapPinned className="mx-auto h-8 w-8 text-slate-400" />
            <h2 className="mt-4 text-2xl font-black text-[#06172f]">No property geometry submitted yet</h2>
            <p className="mt-2 text-slate-500">Captured coordinates and boundaries will appear here once applicants or registry officers save geometry metadata.</p>
          </div>
        ) : null}
      </section>
    </main>
  );
}

function MiniMetric({ icon: Icon, label, value }: { icon: LucideIcon; label: string; value: string }) {
  return (
    <div className="rounded-2xl bg-slate-50 p-3">
      <Icon className="h-4 w-4 text-[#008751]" />
      <p className="mt-2 text-[10px] font-black uppercase tracking-[0.12em] text-slate-500">{label}</p>
      <p className="mt-1 text-sm font-black capitalize text-[#06172f]">{value}</p>
    </div>
  );
}
