import { notFound } from "next/navigation";
import { BoiSectionPage } from "@/components/boi/boi-native-pages";
import { getCurrentUserContext } from "@/lib/auth/session";
import { getBoiOverview, normalizeBoiSearchParams, resolveBoiSection } from "@/lib/data/boi-workspace";

export default async function BoiWorkspaceSectionPage({
  params,
  searchParams,
}: {
  params: Promise<{ section: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const [{ section }, rawSearchParams] = await Promise.all([params, searchParams]);
  const resolvedSection = resolveBoiSection(section);
  if (!resolvedSection) notFound();

  const ctx = await getCurrentUserContext();
  const overview = await getBoiOverview(ctx);
  return <BoiSectionPage section={resolvedSection} overview={overview} filters={normalizeBoiSearchParams(rawSearchParams)} />;
}
