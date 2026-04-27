import type { AFRI } from "@/lib/finance-readiness/service";

function escapePdfText(value: string) {
  return value.replace(/\\/g, "\\\\").replace(/\(/g, "\\(").replace(/\)/g, "\\)");
}

export function buildFinanceReadinessPdf(afri: AFRI, businessId: string) {
  const rows = [
    "DBIN Access to Finance Readiness Report",
    `Business ID: ${businessId}`,
    `Generated: ${new Date(afri.generatedAt).toLocaleString("en-NG")}`,
    "",
    `Identity Score: ${afri.identityScore}`,
    `Financial Score: ${afri.financialScore}`,
    `Compliance Score: ${afri.complianceScore}`,
    `Operational Score: ${afri.operationalScore}`,
    `Growth Score: ${afri.growthScore}`,
    `Overall AFRI: ${afri.overallScore} (${afri.readinessLevel.toUpperCase()})`,
    "",
    "Signals sourced automatically from DBIN verification and compliance records.",
    `Verification status: ${afri.signals.verificationStatus ?? "pending"}`,
    `NIN/BVN/CAC/TIN: ${afri.signals.ninStatus ?? "pending"}/${afri.signals.bvnStatus ?? "pending"}/${afri.signals.cacStatus ?? "pending"}/${afri.signals.tinStatus ?? "pending"}`,
  ];

  const textLines = rows.map((line) => `(${escapePdfText(line)}) Tj`).join(" T* ");
  const stream = `BT /F1 12 Tf 50 780 Td 14 TL ${textLines} ET`;

  const streamBytes = new TextEncoder().encode(stream).length;
  const objects = [
    "1 0 obj << /Type /Catalog /Pages 2 0 R >> endobj",
    "2 0 obj << /Type /Pages /Kids [3 0 R] /Count 1 >> endobj",
    "3 0 obj << /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Resources << /Font << /F1 4 0 R >> >> /Contents 5 0 R >> endobj",
    "4 0 obj << /Type /Font /Subtype /Type1 /BaseFont /Helvetica >> endobj",
    `5 0 obj << /Length ${streamBytes} >> stream\n${stream}\nendstream endobj`,
  ];

  let pdf = "%PDF-1.4\n";
  const offsets: number[] = [];

  for (const object of objects) {
    offsets.push(new TextEncoder().encode(pdf).length);
    pdf += `${object}\n`;
  }

  const xrefStart = new TextEncoder().encode(pdf).length;
  pdf += `xref\n0 ${objects.length + 1}\n`;
  pdf += "0000000000 65535 f \n";
  for (const offset of offsets) {
    pdf += `${offset.toString().padStart(10, "0")} 00000 n \n`;
  }
  pdf += `trailer << /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xrefStart}\n%%EOF`;

  return new TextEncoder().encode(pdf);
}
