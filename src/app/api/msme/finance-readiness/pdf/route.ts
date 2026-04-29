import { NextRequest, NextResponse } from "next/server";
import { getProviderWorkspaceContext } from "@/lib/data/provider-operations";
import { getFinanceReadinessAssessment, type FinanceReadinessPathway } from "@/lib/msme/finance-readiness-assessments";

type Pathway = FinanceReadinessPathway;

const pathwayMeta: Record<Pathway, { title: string }> = {
  loan: { title: "Loan" },
  grant: { title: "Grant" },
  investment: { title: "Investment" },
};

function b(v: string) { return new TextEncoder().encode(v); }
function esc(v: string) { return v.replace(/[()\\]/g, ""); }
function buildPdf(pages: string[]) {
  const objects: string[] = [];
  const pageIds: number[] = [];
  let nextId = 3;
  for (const stream of pages) {
    const contentId = nextId;
    const pageId = nextId + 1;
    objects.push(`${contentId} 0 obj\n<< /Length ${b(stream).length} >>\nstream\n${stream}\nendstream\nendobj\n`);
    objects.push(`${pageId} 0 obj\n<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595.28 841.89] /Resources << /Font << /F1 1 0 R >> >> /Contents ${contentId} 0 R >>\nendobj\n`);
    pageIds.push(pageId);
    nextId += 2;
  }
  const header = "%PDF-1.4\n";
  const root = "1 0 obj\n<< /Type /Catalog /Pages 2 0 R >>\nendobj\n";
  const pagesObj = `2 0 obj\n<< /Type /Pages /Kids [${pageIds.map((id) => `${id} 0 R`).join(" ")}] /Count ${pageIds.length} >>\nendobj\n`;
  const fontObj = `${nextId} 0 obj\n<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>\nendobj\n`;
  const all = [header, root, pagesObj, ...objects, fontObj];
  let pdf = "";
  const xref = [0];
  for (const part of all) { xref.push(b(pdf).length); pdf += part; }
  const start = b(pdf).length;
  pdf += `xref\n0 ${xref.length}\n0000000000 65535 f \n`;
  for (let i = 1; i < xref.length; i += 1) pdf += `${String(xref[i]).padStart(10, "0")} 00000 n \n`;
  pdf += `trailer\n<< /Size ${xref.length} /Root 1 0 R >>\nstartxref\n${start}\n%%EOF`;
  return b(pdf);
}

export async function GET(request: NextRequest) {
  const workspace = await getProviderWorkspaceContext();
  const businessName = workspace.msme.business_name || workspace.provider.display_name || "MSME Business";
  const msmeId = workspace.msme.msme_id || "MSME-ID";

  const url = new URL(request.url);
  const assessmentId = url.searchParams.get("assessmentId") ?? "";
  const persisted = assessmentId ? getFinanceReadinessAssessment(assessmentId) : null;

  const pathway = (persisted?.pathway ?? (url.searchParams.get("pathway") as Pathway | null) ?? "loan");
  const score = persisted?.score ?? Number.parseInt(url.searchParams.get("score") ?? "0", 10);
  const completion = persisted?.completion ?? Number.parseInt(url.searchParams.get("completion") ?? "0", 10);
  const band = persisted?.band ?? url.searchParams.get("band") ?? "Early-stage readiness";

  const now = new Date();
  const top = [
    "BT /F1 12 Tf 40 800 Td (DBIN · Digital Business Identity Network) Tj ET",
    "BT /F1 18 Tf 40 776 Td (ACCESS TO FINANCE READINESS REPORT) Tj ET",
    "BT /F1 12 Tf 40 756 Td (MSME Readiness Diagnostic Summary) Tj ET",
    `BT /F1 10 Tf 40 740 Td (Report date/time: ${esc(now.toLocaleString("en-NG"))}) Tj ET`,
    `BT /F1 10 Tf 40 714 Td (Business name: ${esc(businessName)}) Tj ET`,
    `BT /F1 10 Tf 40 700 Td (DBIN/MSME ID: ${esc(msmeId)}) Tj ET`,
    `BT /F1 10 Tf 40 686 Td (Assessment pathway: ${pathwayMeta[pathway]?.title ?? "Loan"}) Tj ET`,
    "BT /F1 10 Tf 40 672 Td (Funding amount needed: NGN 5,000,000 simulated) Tj ET",
    `BT /F1 24 Tf 40 632 Td (AFRI Score: ${score}/100) Tj ET`,
    `BT /F1 11 Tf 40 610 Td (Readiness band: ${esc(band)}) Tj ET`,
    `BT /F1 11 Tf 40 594 Td (Score progress: ${score} percent) Tj ET`,
    `BT /F1 10 Tf 40 572 Td (Assessment completed: ${completion} percent | Report generated: ${esc(now.toLocaleDateString("en-NG"))}) Tj ET`,
    `BT /F1 10 Tf 40 556 Td (Next review: ${esc(new Date(now.getTime() + 1000 * 60 * 60 * 24 * 90).toLocaleDateString("en-NG"))}) Tj ET`,
  ].join("\n");
  const page2 = [
    "BT /F1 12 Tf 40 800 Td (Strengths) Tj ET",
    "BT /F1 10 Tf 52 784 Td (- Solid identity and registration readiness) Tj ET",
    "BT /F1 10 Tf 52 770 Td (- Structured assessment completion) Tj ET",
    "BT /F1 12 Tf 40 742 Td (Readiness gaps) Tj ET",
    "BT /F1 10 Tf 52 726 Td (- Improve periodic reporting discipline) Tj ET",
    "BT /F1 10 Tf 52 712 Td (- Strengthen risk register documentation) Tj ET",
    "BT /F1 12 Tf 40 684 Td (Risk flags) Tj ET",
    "BT /F1 10 Tf 52 668 Td (- Potential financing mismatch risk) Tj ET",
    "BT /F1 10 Tf 52 654 Td (- Underwriting evidence gaps) Tj ET",
    "BT /F1 12 Tf 40 626 Td (Recommended next actions) Tj ET",
    "BT /F1 10 Tf 52 610 Td (1. Consolidate 12-month financials.) Tj ET",
    "BT /F1 10 Tf 52 596 Td (2. Formalize governance and risk logs.) Tj ET",
    "BT /F1 10 Tf 52 582 Td (3. Prepare use-of-funds schedule.) Tj ET",
    `BT /F1 12 Tf 40 554 Td (Funding signal summary: ${esc(band)} with AFRI ${score}/100.) Tj ET`,
    "BT /F1 11 Tf 40 526 Td (About this report) Tj ET",
    "BT /F1 10 Tf 52 510 Td (This DBIN simulation report supports MSME finance readiness planning.) Tj ET",
    "BT /F1 10 Tf 52 496 Td (It is not a final lender decision document.) Tj ET",
    "BT /F1 11 Tf 40 468 Td (Verify this report / QR placeholder: [ DBIN VERIFY ]) Tj ET",
    "BT /F1 10 Tf 200 60 Td (Powered by Roseate Forte) Tj ET",
  ].join("\n");

  const pdfBytes = buildPdf([top, page2]);
  return new NextResponse(pdfBytes, {
    status: 200,
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="finance-readiness-report-${msmeId}.pdf"`,
      "Cache-Control": "no-store",
    },
  });
}
