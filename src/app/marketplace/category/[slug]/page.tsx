import { redirect } from "next/navigation";

export default async function MarketplaceCategoryAliasPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  redirect(`/categories/${slug}`);
}
