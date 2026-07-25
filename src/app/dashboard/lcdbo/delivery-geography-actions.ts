"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import {
  createOrUpdateActivity,
  createOrUpdateClusterPlan,
  createOrUpdateLgaPlan,
  createOrUpdateStatePlan,
  requireLcdboGeographyDeliveryAccess,
  reviewProgressUpdate,
  submitProgressUpdate,
  type ProgressReviewStatus,
} from "@/lib/data/lcdbo-delivery-geography";

function refresh() {
  revalidatePath("/dashboard/lcdbo");
  revalidatePath("/dashboard/lcdbo/delivery");
  revalidatePath("/dashboard/lcdbo/delivery/states");
  revalidatePath("/dashboard/lcdbo/delivery/lgas");
  revalidatePath("/dashboard/lcdbo/delivery/clusters");
  revalidatePath("/dashboard/lcdbo/my-work");
}

function success(path: string, message: string): never {
  refresh();
  redirect(`${path}?success=${encodeURIComponent(message)}`);
}

function failure(path: string, message: string): never {
  redirect(`${path}?error=${encodeURIComponent(message)}`);
}

export async function saveStateDeliveryPlanAction(formData: FormData) {
  const redirectTo = String(formData.get("redirect_to") ?? "/dashboard/lcdbo/delivery/states");
  try {
    const access = await requireLcdboGeographyDeliveryAccess("view");
    await createOrUpdateStatePlan({ formData, access });
    success(redirectTo, "state_plan_saved");
  } catch {
    failure(redirectTo, "state_plan_save_failed");
  }
}

export async function saveLgaDeliveryPlanAction(formData: FormData) {
  const redirectTo = String(formData.get("redirect_to") ?? "/dashboard/lcdbo/delivery/lgas");
  try {
    const access = await requireLcdboGeographyDeliveryAccess("view");
    await createOrUpdateLgaPlan({ formData, access });
    success(redirectTo, "lga_plan_saved");
  } catch {
    failure(redirectTo, "lga_plan_save_failed");
  }
}

export async function saveClusterDeliveryPlanAction(formData: FormData) {
  const redirectTo = String(formData.get("redirect_to") ?? "/dashboard/lcdbo/delivery/clusters");
  try {
    const access = await requireLcdboGeographyDeliveryAccess("view");
    await createOrUpdateClusterPlan({ formData, access });
    success(redirectTo, "cluster_plan_saved");
  } catch {
    failure(redirectTo, "cluster_plan_save_failed");
  }
}

export async function saveDeliveryActivityAction(formData: FormData) {
  const redirectTo = String(formData.get("redirect_to") ?? "/dashboard/lcdbo/my-work");
  try {
    const access = await requireLcdboGeographyDeliveryAccess("view");
    await createOrUpdateActivity({ formData, access });
    success(redirectTo, "activity_saved");
  } catch {
    failure(redirectTo, "activity_save_failed");
  }
}

export async function submitDeliveryProgressUpdateAction(formData: FormData) {
  const redirectTo = String(formData.get("redirect_to") ?? "/dashboard/lcdbo/my-work");
  try {
    const access = await requireLcdboGeographyDeliveryAccess("view");
    await submitProgressUpdate({ formData, access });
    success(redirectTo, "progress_update_submitted");
  } catch {
    failure(redirectTo, "progress_update_failed");
  }
}

export async function reviewDeliveryProgressUpdateAction(formData: FormData) {
  const redirectTo = String(formData.get("redirect_to") ?? "/dashboard/lcdbo/my-work");
  const updateId = String(formData.get("update_id") ?? "");
  const reviewStatus = String(formData.get("review_status") ?? "") as ProgressReviewStatus;
  try {
    const access = await requireLcdboGeographyDeliveryAccess("manage");
    await reviewProgressUpdate({ updateId, reviewStatus, reviewNotes: String(formData.get("review_notes") ?? ""), access });
    success(redirectTo, "progress_update_reviewed");
  } catch {
    failure(redirectTo, "progress_review_failed");
  }
}
