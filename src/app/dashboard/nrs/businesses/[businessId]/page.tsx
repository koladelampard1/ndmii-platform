import { NrsBusinessProfile } from "@/components/nrs/nrs-formalisation-workspace";
import { getCurrentUserContext } from "@/lib/auth/session";
import { getNrsBusinessProfile } from "@/lib/data/nrs-formalisation";

export default async function NrsBusinessProfilePage({
  params,
}: {
  params: Promise<{ businessId: string }>;
}) {
  const [{ businessId }, ctx] = await Promise.all([params, getCurrentUserContext()]);
  const { business } = await getNrsBusinessProfile(ctx, businessId);
  return <NrsBusinessProfile business={business} />;
}
