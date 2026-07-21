import { BoiBusinessDossier } from "@/components/boi/boi-native-pages";
import { getCurrentUserContext } from "@/lib/auth/session";
import { getBoiBusinessDetail } from "@/lib/data/boi-workspace";

export default async function BoiBusinessDetailPage({ params }: { params: Promise<{ businessId: string }> }) {
  const [{ businessId }, ctx] = await Promise.all([params, getCurrentUserContext()]);
  const detail = await getBoiBusinessDetail(ctx, businessId);
  return <BoiBusinessDossier detail={detail} />;
}
