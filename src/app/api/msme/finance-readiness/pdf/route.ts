import { NextRequest, NextResponse } from "next/server";
import { PDFDocument, StandardFonts } from "pdf-lib";
import { getProviderWorkspaceContext } from "@/lib/data/provider-operations";
import { getFinanceReadinessAssessment, type FinanceReadinessPathway } from "@/lib/msme/finance-readiness-assessments";

export const runtime = "nodejs";

type Pathway = FinanceReadinessPathway;

const pathwayMeta: Record<Pathway, { title: string }> = {
  loan: { title: "Loan" },
  grant: { title: "Grant" },
  investment: { title: "Investment" },
};

export async function GET(request: NextRequest) {
  try {
    const url = new URL(request.url);
    const assessmentId = url.searchParams.get("assessmentId") ?? "";

    const workspace = await getProviderWorkspaceContext();
    const businessName = workspace.msme.business_name || workspace.provider.display_name || "MSME Business";
    const msmeId = workspace.msme.msme_id || "MSME-ID";

    const persisted = assessmentId ? getFinanceReadinessAssessment(assessmentId) : null;

    const pathway = persisted?.pathway ?? ((url.searchParams.get("pathway") as Pathway | null) ?? "loan");
    const score = persisted?.score ?? Number.parseInt(url.searchParams.get("score") ?? "0", 10);
    const band = persisted?.band ?? url.searchParams.get("band") ?? "Early-stage readiness";

    const pdfDoc = await PDFDocument.create();
    const page = pdfDoc.addPage([595.28, 841.89]);
    const font = await pdfDoc.embedFont(StandardFonts.Helvetica);

    const reportDate = new Date().toLocaleDateString("en-NG", {
      year: "numeric",
      month: "long",
      day: "numeric",
    });

    const pathwayTitle = pathwayMeta[pathway]?.title ?? "Loan";
    const lines = [
      "ACCESS TO FINANCE READINESS REPORT",
      `Business name: ${businessName}`,
      `MSME ID: ${msmeId}`,
      `AFRI score: ${score}/100`,
      `Readiness band: ${band}`,
      `Pathway: ${pathwayTitle}`,
      `Report date: ${reportDate}`,
    ];

    let y = 790;
    for (const [index, line] of lines.entries()) {
      page.drawText(line, {
        x: 40,
        y,
        font,
        size: index === 0 ? 18 : 12,
      });
      y -= index === 0 ? 36 : 24;
    }

    const pdfBytes = await pdfDoc.save();

    console.log("[AFRI PDF GENERATED]", {
      assessmentId,
      msmeId,
      byteLength: pdfBytes.length,
    });

    return new NextResponse(pdfBytes, {
      status: 200,
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `inline; filename="finance-readiness-report-${msmeId}.pdf"`,
        "Cache-Control": "no-store",
        "X-Content-Type-Options": "nosniff",
      },
    });
  } catch (error) {
    console.error("[finance-readiness-pdf][route_error]", error);
    const message = error instanceof Error ? error.message : "Unknown server error";
    return NextResponse.json(
      {
        error: "PDF generation failed. Please try again.",
        message,
      },
      { status: 500 },
    );
  }
}
