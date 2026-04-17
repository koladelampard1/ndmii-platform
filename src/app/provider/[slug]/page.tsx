import { redirect } from "next/navigation";

export default async function ProviderSlugAliasPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  redirect(`/providers/${slug}`);
}
