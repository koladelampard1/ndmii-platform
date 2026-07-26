"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import {
  createEvidenceLink,
  reviewEvidenceLink,
  savePilotReadinessAssessment,
} from "@/lib/data/lcdbo-delivery-intelligence";

function refresh() {
  revalidatePath("/dashboard/lcdbo/executive");
  revalidatePath("/dashboard/lcdbo/executive/attention");
  revalidatePath("/dashboard/lcdbo/evidence");
  revalidatePath("/dashboard/lcdbo/pilot-readiness");
  revalidatePath("/dashboard/lcdbo/reports");
}

function done(path: string, key: string): never {
  refresh();
  redirect(`${path}?success=${encodeURIComponent(key)}`);
}

function failed(path: string, key: string): never {
  redirect(`${path}?error=${encodeURIComponent(key)}`);
}

export async function linkLcdboEvidenceAction(formData: FormData) {
  const redirectTo = String(formData.get("redirect_to") ?? "/dashboard/lcdbo/evidence");
  try {
    await createEvidenceLink({ formData });
    done(redirectTo, "evidence_linked");
  } catch {
    failed(redirectTo, "evidence_link_failed");
  }
}

export async function reviewLcdboEvidenceAction(formData: FormData) {
  const redirectTo = String(formData.get("redirect_to") ?? "/dashboard/lcdbo/evidence");
  try {
    await reviewEvidenceLink({ formData });
    done(redirectTo, "evidence_reviewed");
  } catch {
    failed(redirectTo, "evidence_review_failed");
  }
}

export async function savePilotReadinessAction(formData: FormData) {
  const redirectTo = String(formData.get("redirect_to") ?? "/dashboard/lcdbo/pilot-readiness");
  try {
    await savePilotReadinessAssessment({ formData });
    done(redirectTo, "pilot_readiness_saved");
  } catch {
    failed(redirectTo, "pilot_readiness_failed");
  }
}
