export const SUPPORTED_MSME_SECTORS = [
  "Automobile",
  "Welding",
  "Tailoring",
  "Carpentry",
  "Electrical Services",
  "Plumbing",
  "ICT Repair",
  "Fabrication",
  "Mechanics",
  "Generator Repair",
] as const;

export function mergeSupportedSectors(sectors: Array<string | null | undefined>) {
  return [...new Set([...sectors.filter(Boolean), ...SUPPORTED_MSME_SECTORS])] as string[];
}
