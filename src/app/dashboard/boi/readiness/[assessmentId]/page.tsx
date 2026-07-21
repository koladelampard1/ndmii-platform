import { BoiAssessmentDetailPage } from "@/components/boi/boi-native-pages";
import { getCurrentUserContext } from "@/lib/auth/session";
import { getBoiAssessmentDetail } from "@/lib/data/boi-workspace";

export default async function BoiReadinessDetailPage({ params }: { params: Promise<{ assessmentId: string }> }) {
  const [{ assessmentId }, ctx] = await Promise.all([params, getCurrentUserContext()]);
  const detail = await getBoiAssessmentDetail(ctx, assessmentId);
  return <BoiAssessmentDetailPage detail={detail} />;
}
