"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requirePropertyWorkspaceAccess } from "@/app/dashboard/property/_queries";
import { deletePropertyDraft, savePropertyRegistration } from "@/lib/property/property-registration-service";
import { formValue, nullable } from "@/lib/property/property-registration-validation";

function revalidatePropertyWorkspace() {
  revalidatePath("/dashboard/property");
  revalidatePath("/dashboard/property/register");
  revalidatePath("/dashboard/property/my-properties");
  revalidatePath("/dashboard/property/drafts");
}

export async function savePropertyRegistrationAction(formData: FormData) {
  const { ctx, supabase } = await requirePropertyWorkspaceAccess();
  let result: Awaited<ReturnType<typeof savePropertyRegistration>>;
  try {
    result = await savePropertyRegistration({ formData, ctx, supabase });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to save property registration.";
    redirect(`/dashboard/property/register?error=${encodeURIComponent(message)}`);
  }

  revalidatePropertyWorkspace();
  if (result.intent === "submit") {
    redirect("/dashboard/property/my-properties?success=submitted");
  }
  const step = result.nextStep ? `&step=${result.nextStep}` : "";
  redirect(`/dashboard/property/register?property=${result.propertyId}&success=draft_saved${step}`);
}

export async function deletePropertyDraftAction(formData: FormData) {
  const { ctx, supabase } = await requirePropertyWorkspaceAccess();
  const propertyId = nullable(formValue(formData, "property_id"));
  if (!propertyId || !ctx.appUserId) redirect("/access-denied");
  await deletePropertyDraft({ propertyId, actorUserId: ctx.appUserId, supabase });
  revalidatePropertyWorkspace();
  redirect("/dashboard/property/drafts?success=draft_deleted");
}
