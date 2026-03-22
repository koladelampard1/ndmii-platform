import { supabase } from "@/lib/supabase/client";
import { verifyWithAdapter, type VerificationProvider, type VerificationState } from "@/lib/integrations/adapters";

export type MsmeRecord = {
  id: string;
  msme_id: string;
  business_name: string;
  owner_name: string;
  state: string;
  sector: string;
  verification_status: string;
  association_id: string | null;
  nin: string | null;
  bvn: string | null;
  cac_number: string | null;
  tin: string | null;
  created_at: string;
};

const fallbackMsmes: MsmeRecord[] = [
  {
    id: "demo-1",
    msme_id: "NDMII-LAG-0001",
    business_name: "Eko Fresh Foods Ltd",
    owner_name: "Chinedu Eze",
    state: "Lagos",
    sector: "Agro-processing",
    verification_status: "verified",
    association_id: null,
    nin: "NIN1000001",
    bvn: "BVN1000001",
    cac_number: "RC1000001",
    tin: "TIN1000001",
    created_at: new Date().toISOString(),
  },
  {
    id: "demo-2",
    msme_id: "NDMII-KAN-0002",
    business_name: "Arewa Retail Hub",
    owner_name: "Musa Idris",
    state: "Kano",
    sector: "Retail",
    verification_status: "pending",
    association_id: null,
    nin: "NIN1000004",
    bvn: "BVN1000004",
    cac_number: "RC1000004",
    tin: "TIN1000004",
    created_at: new Date().toISOString(),
  },
];

export async function getMsmes() {
  const { data, error } = await supabase.from("msmes").select("*").order("created_at", { ascending: false });
  if (error || !data) return fallbackMsmes;
  return data as MsmeRecord[];
}

export async function getDashboardMetrics() {
  const msmes = await getMsmes();
  const total = msmes.length;
  const verified = msmes.filter((item) => item.verification_status === "verified").length;
  const pending = msmes.filter((item) => item.verification_status === "pending").length;
  const suspended = msmes.filter((item) => item.verification_status === "suspended").length;

  const [{ count: complaintsCount }, { data: payments }, { count: completedKyc }] = await Promise.all([
    supabase.from("complaints").select("*", { count: "exact", head: true }),
    supabase.from("payments").select("amount,status"),
    supabase.from("compliance_profiles").select("*", { count: "exact", head: true }).eq("overall_status", "verified"),
  ]);

  const paidTotal = (payments ?? []).reduce((sum, row) => sum + Number(row.amount ?? 0), 0);
  const kycCompletionRate = total ? Math.round(((completedKyc ?? 0) / total) * 100) : 0;

  return {
    cards: [
      { title: "Total MSMEs", value: total.toLocaleString(), status: "up" as const },
      { title: "Pending Review", value: pending.toLocaleString(), status: "down" as const },
      { title: "Verified MSMEs", value: verified.toLocaleString(), status: "up" as const },
      { title: "Suspended MSMEs", value: suspended.toLocaleString(), status: "down" as const },
      { title: "KYC Completion Rate", value: `${kycCompletionRate}%`, status: "up" as const },
      { title: "Complaints Count", value: (complaintsCount ?? 0).toLocaleString(), status: "down" as const },
      { title: "Revenue Collected", value: `₦${paidTotal.toLocaleString()}`, status: "up" as const },
    ],
    stateDistribution: Object.entries(
      msmes.reduce<Record<string, number>>((acc, row) => {
        acc[row.state] = (acc[row.state] ?? 0) + 1;
        return acc;
      }, {})
    ).map(([state, totalMsmes]) => ({ state, totalMsmes })),
    sectorDistribution: Object.entries(
      msmes.reduce<Record<string, number>>((acc, row) => {
        acc[row.sector] = (acc[row.sector] ?? 0) + 1;
        return acc;
      }, {})
    ).map(([sector, totalMsmes]) => ({ sector, totalMsmes })),
  };
}

export function generateMsmeId(state: string) {
  const prefix = (state || "LAG").slice(0, 3).toUpperCase();
  const serial = `${Date.now()}`.slice(-6);
  const checksum = Math.floor(100 + Math.random() * 900);
  return `NDMII-${prefix}-${serial}${checksum}`;
}

export async function runKycSimulation(payload: Record<VerificationProvider, string>) {
  const checks = await Promise.all(
    Object.entries(payload).map(([provider, identifier]) =>
      verifyWithAdapter(provider as VerificationProvider, identifier)
    )
  );
  const overallStatus: VerificationState = checks.some((item) => item.status === "failed" || item.status === "mismatch")
    ? "failed"
    : checks.some((item) => item.status === "pending")
      ? "pending"
      : "verified";

  return { checks, overallStatus };
}

export async function searchMsme(query: string) {
  const trimmed = query.trim();
  const msmes = await getMsmes();
  if (!trimmed) return msmes.slice(0, 15);
  const q = trimmed.toLowerCase();
  return msmes.filter(
    (row) => row.msme_id.toLowerCase().includes(q) || row.business_name.toLowerCase().includes(q)
  );
}
