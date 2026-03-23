import { redirect } from "next/navigation";

export default async function IdCardDetailRedirect({ params }: { params: Promise<{ msmeId: string }> }) {
  const { msmeId } = await params;
  redirect(`/dashboard/msme/id-card?msmeId=${encodeURIComponent(msmeId)}`);
}
