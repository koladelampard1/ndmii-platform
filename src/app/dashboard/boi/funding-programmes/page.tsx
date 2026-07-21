import { BoiSectionPage } from "@/components/boi/boi-native-pages";
import { getCurrentUserContext } from "@/lib/auth/session";
import { getBoiOverview } from "@/lib/data/boi-workspace";

export default async function BoiFundingProgrammesPage() {
  const ctx = await getCurrentUserContext();
  const overview = await getBoiOverview(ctx);
  return <BoiSectionPage section="funding-programmes" overview={overview} filters={{}} />;
}
