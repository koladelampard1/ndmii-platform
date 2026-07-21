import { BoiSectionPage } from "@/components/boi/boi-native-pages";
import { getCurrentUserContext } from "@/lib/auth/session";
import { getBoiOverview, normalizeBoiSearchParams } from "@/lib/data/boi-workspace";

export default async function BoiBusinessesPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const [ctx, rawSearchParams] = await Promise.all([getCurrentUserContext(), searchParams]);
  const overview = await getBoiOverview(ctx);
  return <BoiSectionPage section="businesses" overview={overview} filters={normalizeBoiSearchParams(rawSearchParams)} />;
}
