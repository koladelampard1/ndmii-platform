import { redirect } from "next/navigation";

export default async function LegacyNrsBusinessProfileRedirect({
  params,
}: {
  params: Promise<{ msmeId: string }>;
}) {
  const { msmeId } = await params;
  redirect(`/dashboard/nrs/businesses/${encodeURIComponent(msmeId)}`);
}
