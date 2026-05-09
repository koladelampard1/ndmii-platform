import { NextResponse } from "next/server";
import { getBusinessPlanSession, getBusinessPlanWorkspace } from "@/lib/data/business-plan";
import { createBusinessPlanPdf, businessPlanPdfFilename } from "@/lib/msme/business-plan-pdf";

function htmlError(message: string, status = 500) {
  const safeMessage = message.replace(/[<>&"]/g, (ch) => ({ "<": "&lt;", ">": "&gt;", "&": "&amp;", '"': "&quot;" }[ch] ?? ch));
  return new NextResponse(`<!doctype html><html><head><meta charset="utf-8"/><title>Business Plan PDF Error</title></head><body><h1>Unable to generate business plan PDF</h1><p>${safeMessage}</p></body></html>`, {
    status,
    headers: {
      "Content-Type": "text/html; charset=utf-8",
      "Cache-Control": "no-store",
      "X-Content-Type-Options": "nosniff",
    },
  });
}

export async function GET(_request: Request, { params }: { params: Promise<{ sessionId: string }> }) {
  try {
    const { sessionId } = await params;
    const workspace = await getBusinessPlanWorkspace();
    const session = await getBusinessPlanSession(sessionId, workspace);
    if (!session) return htmlError("Business plan session not found.", 404);
    if (!session.generated_plan_json) return htmlError("Generate the business plan before downloading PDF.", 400);

    const pdfBytes = createBusinessPlanPdf(session.generated_plan_json);
    return new NextResponse(pdfBytes, {
      status: 200,
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="${businessPlanPdfFilename(session.business_name || session.generated_plan_json.businessName)}"`,
        "Cache-Control": "no-store",
        "Content-Length": String(pdfBytes.length),
        "X-Content-Type-Options": "nosniff",
      },
    });
  } catch (error) {
    console.error("[business-plan-pdf][route_error]", error);
    return htmlError(error instanceof Error ? error.message : "Unknown server error", 500);
  }
}
