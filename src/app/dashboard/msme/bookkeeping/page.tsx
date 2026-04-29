import { getProviderWorkspaceContext } from "@/lib/data/provider-operations";
import { MsmeBookkeepingClient } from "./page-client";

export default async function MsmeBookkeepingPage() {
  const workspace = await getProviderWorkspaceContext();
  return <MsmeBookkeepingClient msmeId={workspace.msme.id} />;
}
