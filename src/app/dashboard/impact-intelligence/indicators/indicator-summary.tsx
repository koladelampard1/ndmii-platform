import Link from "next/link";
import type {
  ImpactIndicatorMeasurement,
  IndicatorAggregate,
} from "@/lib/data/impact-indicators";

function formatValue(value: number | null, unit?: string | null) {
  if (value === null) return "Not set";
  return `${value.toLocaleString("en-NG", { maximumFractionDigits: 2 })}${unit ? ` ${unit}` : ""}`;
}

export function IndicatorSummary({
  title = "Impact indicators",
  aggregate,
  measurements = [],
  unavailable = false,
}: {
  title?: string;
  aggregate: IndicatorAggregate | null;
  measurements?: ImpactIndicatorMeasurement[];
  unavailable?: boolean;
}) {
  return (
    <article className="rounded-xl border bg-white p-5 shadow-sm">
      <div className="flex items-center justify-between gap-3">
        <h2 className="font-semibold text-slate-950">{title}</h2>
        <Link href="/dashboard/impact-intelligence/indicators" className="text-sm font-medium text-emerald-700">
          Open indicators
        </Link>
      </div>

      {unavailable ? (
        <p className="mt-4 rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800">
          Indicator data is temporarily unavailable. The rest of this record remains available.
        </p>
      ) : (
        <>
          {aggregate && (
            <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              <div className="rounded-lg border bg-slate-50 p-3"><p className="text-xs text-slate-500">Definitions</p><p className="mt-1 text-lg font-semibold text-slate-950">{aggregate.definitionCount}</p></div>
              <div className="rounded-lg border bg-slate-50 p-3"><p className="text-xs text-slate-500">Verified measurements</p><p className="mt-1 text-lg font-semibold text-slate-950">{aggregate.verifiedMeasurementCount}</p></div>
              <div className="rounded-lg border bg-slate-50 p-3"><p className="text-xs text-slate-500">Average progress</p><p className="mt-1 text-lg font-semibold text-slate-950">{aggregate.averageProgressPercentage === null ? "Not available" : `${aggregate.averageProgressPercentage}%`}</p></div>
              <div className="rounded-lg border bg-slate-50 p-3"><p className="text-xs text-slate-500">Achieved / on track</p><p className="mt-1 text-lg font-semibold text-slate-950">{aggregate.achievedCount} / {aggregate.onTrackCount}</p></div>
            </div>
          )}

          {measurements.length > 0 && (
            <div className="mt-4 space-y-2">
              {measurements.slice(0, 6).map((item) => (
                <div key={item.id} className="flex flex-col gap-2 rounded-lg border p-3 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <p className="font-medium text-slate-950">{item.impact_indicator_definitions?.name ?? "Indicator measurement"}</p>
                    <p className="mt-1 text-xs text-slate-500">
                      {item.source_type.replaceAll("_", " ")} · {item.measurement_date} · {item.verification_status}
                      {item.assessment_score_run_id ? ` · score run ${item.assessment_score_run_id.slice(0, 8)}` : ""}
                    </p>
                  </div>
                  <div className="text-sm sm:text-right">
                    <p className="font-semibold text-slate-950">{formatValue(item.measured_value, item.impact_indicator_definitions?.unit_of_measure)}</p>
                    <p className="text-xs text-slate-500">{item.progress_percentage === null ? item.outcome_status : `${item.progress_percentage}% · ${item.outcome_status.replaceAll("_", " ")}`}</p>
                  </div>
                </div>
              ))}
            </div>
          )}
          {measurements.length === 0 && !aggregate && (
            <p className="mt-4 rounded-lg border border-dashed bg-slate-50 p-4 text-sm text-slate-600">
              No indicator measurements are linked to this record.
            </p>
          )}

          <p className="mt-4 text-xs text-slate-500">Only verified measurements are included in official aggregate totals.</p>
        </>
      )}
    </article>
  );
}
