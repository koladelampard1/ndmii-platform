"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import {
  createOrUpdateDecision,
  createOrUpdateDeliveryItem,
  createOrUpdateRaidItem,
  createOrUpdateWorkstream,
  requireLcdboDeliveryAccess,
} from "@/lib/data/lcdbo-delivery";

function success(path: string, message: string): never {
  revalidatePath("/dashboard/lcdbo");
  revalidatePath("/dashboard/lcdbo/delivery");
  revalidatePath("/dashboard/lcdbo/workstreams");
  revalidatePath("/dashboard/lcdbo/milestones");
  revalidatePath("/dashboard/lcdbo/raid");
  revalidatePath("/dashboard/lcdbo/decisions");
  revalidatePath("/dashboard/lcdbo/calendar");
  redirect(`${path}?success=${encodeURIComponent(message)}`);
}

function failure(path: string, message: string): never {
  redirect(`${path}?error=${encodeURIComponent(message)}`);
}

export async function saveWorkstreamAction(formData: FormData) {
  const redirectTo = String(formData.get("redirect_to") ?? "/dashboard/lcdbo/workstreams");
  try {
    const { ctx, programme, supabase } = await requireLcdboDeliveryAccess("manage");
    await createOrUpdateWorkstream({ formData, actorUserId: ctx.appUserId!, programmeId: programme.id, client: supabase });
    success(redirectTo, "workstream_saved");
  } catch {
    failure(redirectTo, "workstream_save_failed");
  }
}

export async function saveDeliveryItemAction(formData: FormData) {
  const redirectTo = String(formData.get("redirect_to") ?? "/dashboard/lcdbo/milestones");
  try {
    const { ctx, programme, supabase } = await requireLcdboDeliveryAccess("manage");
    await createOrUpdateDeliveryItem({ formData, actorUserId: ctx.appUserId!, programmeId: programme.id, client: supabase });
    success(redirectTo, "delivery_item_saved");
  } catch {
    failure(redirectTo, "delivery_item_save_failed");
  }
}

export async function saveRaidItemAction(formData: FormData) {
  const redirectTo = String(formData.get("redirect_to") ?? "/dashboard/lcdbo/raid");
  try {
    const { ctx, programme, supabase } = await requireLcdboDeliveryAccess("manage");
    await createOrUpdateRaidItem({ formData, actorUserId: ctx.appUserId!, programmeId: programme.id, client: supabase });
    success(redirectTo, "raid_item_saved");
  } catch {
    failure(redirectTo, "raid_item_save_failed");
  }
}

export async function saveDecisionAction(formData: FormData) {
  const redirectTo = String(formData.get("redirect_to") ?? "/dashboard/lcdbo/decisions");
  try {
    const { ctx, programme, supabase } = await requireLcdboDeliveryAccess("manage");
    await createOrUpdateDecision({ formData, actorUserId: ctx.appUserId!, programmeId: programme.id, client: supabase });
    success(redirectTo, "decision_saved");
  } catch {
    failure(redirectTo, "decision_save_failed");
  }
}
