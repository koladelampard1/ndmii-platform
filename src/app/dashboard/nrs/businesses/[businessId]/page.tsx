import { NrsBusinessProfile } from "@/components/nrs/nrs-formalisation-workspace";
import { requireWorkspaceRole } from "@/lib/auth/workspace-guards";
import { NRS_ACCESS_ROLES } from "@/lib/nrs/access";
import { getNrsBusinessProfile } from "@/lib/data/nrs-formalisation";

export default async function NrsBusinessProfilePage({
  params,
}: {
  params: Promise<{ businessId: string }>;
}) {
  const [{ businessId }, ctx] = await Promise.all([params, requireWorkspaceRole([...NRS_ACCESS_ROLES], "/dashboard/nrs/businesses")]);
  const { business } = await getNrsBusinessProfile(ctx, businessId);
  return <NrsBusinessProfile business={business} />;
}
