import { redirect } from "next/navigation";

export default async function RegisterMsmeEntryPage({
  searchParams,
}: {
  searchParams: Promise<{ programme?: string; source?: string; path?: string; registration_path?: string }>;
}) {
  const params = await searchParams;
  const forwarded = new URLSearchParams();
  if (params.programme) forwarded.set("programme", params.programme);
  if (params.source) forwarded.set("source", params.source);
  if (params.registration_path ?? params.path) forwarded.set("path", params.registration_path ?? params.path ?? "independent");
  redirect(`/register${forwarded.size ? `?${forwarded.toString()}` : ""}`);
}
