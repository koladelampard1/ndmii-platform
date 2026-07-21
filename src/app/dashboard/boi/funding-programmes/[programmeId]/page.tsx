import { BoiProgrammeDetailPage } from "@/components/boi/boi-native-pages";
import { getCurrentUserContext } from "@/lib/auth/session";
import { getBoiProgrammeDetail } from "@/lib/data/boi-workspace";

export default async function BoiFundingProgrammeDetailPage({ params }: { params: Promise<{ programmeId: string }> }) {
  const [{ programmeId }, ctx] = await Promise.all([params, getCurrentUserContext()]);
  const detail = await getBoiProgrammeDetail(ctx, programmeId);
  return <BoiProgrammeDetailPage detail={detail} />;
}
