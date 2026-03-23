import { redirect } from "next/navigation";

export default async function LegacyFirsDetail({ params }: { params: Promise<{ msmeId: string }> }) {
  const { msmeId } = await params;
  redirect(`/dashboard/nrs/${encodeURIComponent(msmeId)}`);
}
