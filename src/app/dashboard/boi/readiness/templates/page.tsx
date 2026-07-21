import { BoiReadinessTemplatesPage } from "@/components/boi/boi-native-pages";
import { getCurrentUserContext } from "@/lib/auth/session";
import { getBoiWorkspaceData } from "@/lib/data/boi-workspace";

export default async function BoiReadinessTemplatesRoute() {
  const ctx = await getCurrentUserContext();
  const data = await getBoiWorkspaceData(ctx);
  return <BoiReadinessTemplatesPage data={data} />;
}
