import { getPublicVerificationDetail } from "@/lib/data/public-verification";
import { createServiceRoleSupabaseClient } from "@/lib/supabase/server";

const formatDate = (value?: string | null) => {
  if (!value) return "Not Available";

  return new Date(value).toLocaleDateString("en-US", {
    month: "long",
    day: "numeric",
    year: "numeric",
  });
};

export async function GET(_request: Request, { params }: { params: Promise<{ businessId: string }> }) {
  const { businessId } = await params;
  const detail = await getPublicVerificationDetail(businessId);

  if (!detail) {
    return new Response("Verification not found", { status: 404 });
  }

  const supabase = await createServiceRoleSupabaseClient();
  const { data: validation } = await supabase
    .from("validation_results")
    .select("validated_at")
    .eq("msme_id", detail.msme.id)
    .maybeSingle();

  const issuedDate = formatDate(detail.digitalId?.issued_at ?? detail.msme.issued_at);
  const lastValidated = formatDate(validation?.validated_at ?? detail.digitalId?.issued_at ?? detail.msme.issued_at);
  const reportDate = formatDate(new Date().toISOString());
  const verificationUrl = `https://bin.gov.ng/verify/${detail.resolvedId}`;
  const snapshot = detail.digitalId?.validation_snapshot && typeof detail.digitalId.validation_snapshot === "object"
    ? (detail.digitalId.validation_snapshot as Record<string, unknown>)
    : {};
  const registryStatus = detail.msme.suspended ? "Suspended" : detail.msme.flagged ? "Flagged" : "Good Standing";

  const escapePdf = (value: string) => value.replaceAll("\\", "\\\\").replaceAll("(", "\\(").replaceAll(")", "\\)");
  const num = (value: unknown, fallback: number) => {
    if (typeof value === "number" && Number.isFinite(value)) return Math.max(0, Math.min(100, value));
    if (typeof value === "string") {
      const parsed = Number.parseFloat(value.replace("%", "").trim());
      if (Number.isFinite(parsed)) return Math.max(0, Math.min(100, parsed));
    }
    return fallback;
  };
  const asTextArray = (value: unknown, fallback: string[]) =>
    Array.isArray(value) ? value.filter((item) => typeof item === "string").slice(0, 5) as string[] : fallback;
  const wrapText = (text: string, maxChars = 52) => {
    const words = text.split(/\s+/).filter(Boolean);
    const lines: string[] = [];
    let line = "";
    for (const word of words) {
      const next = line ? `${line} ${word}` : word;
      if (next.length > maxChars) {
        if (line) lines.push(line);
        line = word;
      } else {
        line = next;
      }
    }
    if (line) lines.push(line);
    return lines.length > 0 ? lines : [text];
  };

  const afriScore = num(snapshot.afri_score ?? snapshot.readiness_score ?? snapshot.score, 52);
  const readinessBand = afriScore >= 75 ? "Investment Ready" : afriScore >= 60 ? "Strong" : afriScore >= 45 ? "Emerging" : "Needs Support";
  const pathway = typeof snapshot.assessment_pathway === "string" ? snapshot.assessment_pathway : "Loan / Grant / Investment";
  const categoryScores = [
    { label: "Business Identity", value: num(snapshot.business_identity_score, Math.min(95, afriScore + 18)), color: "0.09 0.55 0.27" },
    { label: "Financial Records", value: num(snapshot.financial_records_score, Math.min(90, afriScore + 10)), color: "0.12 0.49 0.27" },
    { label: "Tax & Compliance", value: num(snapshot.tax_compliance_score, Math.max(30, afriScore - 12)), color: "0.95 0.67 0.08" },
    { label: "Operations Stability", value: num(snapshot.operations_stability_score, Math.max(30, afriScore - 10)), color: "0.95 0.67 0.08" },
    { label: "Growth Intent", value: num(snapshot.growth_intent_score, afriScore), color: "0.09 0.55 0.27" },
    { label: "Risk Signals", value: num(snapshot.risk_signals_score, Math.max(25, afriScore - 15)), color: "0.80 0.17 0.17" },
  ];

  const strengths = asTextArray(snapshot.strengths, [
    "Verified business identity",
    "Consistent transaction tracking",
    "Good bookkeeping discipline",
  ]);
  const gaps = asTextArray(snapshot.readiness_gaps, [
    "Tax filings not up to date",
    "Incomplete compliance documents",
    "Limited operational documentation",
  ]);
  const riskMessage =
    typeof snapshot.risk_flag === "string"
      ? snapshot.risk_flag
      : detail.msme.flagged
        ? "Existing registry risk markers require remediation before financing."
        : "High debt pressure may affect repayment readiness.";
  const fundingType =
    typeof snapshot.recommended_funding_type === "string"
      ? snapshot.recommended_funding_type
      : afriScore >= 70
        ? "Investment"
        : afriScore >= 55
          ? "Loan"
          : afriScore >= 45
            ? "Grant"
            : "Not ready yet";
  const confidence = afriScore >= 70 ? "Strong" : afriScore >= 50 ? "Moderate" : "Low";
  const bandColor =
    readinessBand === "Investment Ready"
      ? "0.07 0.50 0.25"
      : readinessBand === "Strong"
        ? "0.10 0.60 0.30"
        : readinessBand === "Emerging"
          ? "0.95 0.75 0.30"
          : "0.87 0.62 0.12";

  const drawRect = (x: number, y: number, w: number, h: number, fillRgb?: string, strokeRgb?: string, lineWidth = 1) => {
    const cmds: string[] = [];
    if (fillRgb) cmds.push(`${fillRgb} rg`);
    if (strokeRgb) cmds.push(`${strokeRgb} RG ${lineWidth} w`);
    cmds.push(`${x} ${y} ${w} ${h} re ${fillRgb && strokeRgb ? "B" : fillRgb ? "f" : "S"}`);
    return cmds;
  };
  const drawText = (text: string, x: number, y: number, size = 10, bold = false, rgb = "0.10 0.16 0.13") => [
    "BT",
    `${rgb} rg`,
    `/${bold ? "F2" : "F1"} ${size} Tf`,
    `1 0 0 1 ${x} ${y} Tm`,
    `(${escapePdf(text)}) Tj`,
    "ET",
  ];
  const drawProgress = (x: number, y: number, w: number, h: number, pct: number, color: string) => [
    ...drawRect(x, y, w, h, "0.90 0.93 0.91"),
    ...drawRect(x, y, (w * pct) / 100, h, color),
  ];

  const content: string[] = [];
  content.push(...drawRect(30, 30, 535, 782, "1 1 1", "0.83 0.87 0.84"));
  content.push(...drawRect(30, 760, 535, 52, "0.95 0.98 0.96"));
  content.push(...drawRect(42, 774, 16, 16, "0.12 0.56 0.30"));
  content.push(...drawText("DBIN", 66, 779, 18, true, "0.05 0.42 0.21"));
  content.push(...drawText("Access to Finance Readiness Report", 170, 786, 14, true, "0.06 0.29 0.15"));
  content.push(...drawText("MSME Readiness Diagnostic Summary", 170, 772, 10, false, "0.25 0.31 0.28"));

  content.push(...drawRect(42, 716, 511, 38, "0.98 0.99 0.98", "0.85 0.89 0.86"));
  const meta: Array<[string, string]> = [
    ["Date generated", reportDate],
    ["MSME name", detail.msme.business_name || "Not Available"],
    ["DBIN / MSME ID", detail.resolvedId],
    ["Assessment pathway", pathway],
  ];
  let metaX = 50;
  for (const [label, value] of meta) {
    content.push(...drawText(label, metaX, 741, 8, true, "0.35 0.42 0.38"));
    content.push(...drawText(value, metaX, 728, 10, true, "0.10 0.18 0.14"));
    metaX += 126;
  }

  content.push(...drawRect(42, 617, 511, 92, "0.04 0.36 0.18", "0.04 0.36 0.18"));
  content.push(...drawText("AFRI SCORE SUMMARY", 60, 692, 10, true, "1 1 1"));
  content.push(...drawText(`AFRI SCORE: ${Math.round(afriScore)}%`, 60, 655, 30, true, "1 1 1"));
  content.push(...drawProgress(60, 632, 220, 10, afriScore, "0.29 0.78 0.46"));
  content.push(...drawText("0%", 60, 621, 7, false, "0.85 0.96 0.89"));
  content.push(...drawText("100%", 264, 621, 7, false, "0.85 0.96 0.89"));
  content.push(...drawText("Readiness Band", 320, 692, 10, true, "1 1 1"));
  content.push(...drawRect(320, 665, 145, 22, bandColor));
  content.push(...drawText(readinessBand, 332, 672, 11, true, "0.14 0.20 0.15"));
  content.push(...drawText(`Registry Status: ${registryStatus}`, 320, 646, 9, false, "0.84 0.94 0.88"));
  content.push(...drawText(`Last validated: ${lastValidated}`, 320, 632, 9, false, "0.84 0.94 0.88"));
  content.push(...drawText(`Issued: ${issuedDate}`, 320, 619, 9, false, "0.84 0.94 0.88"));

  content.push(...drawRect(42, 476, 511, 130, "0.99 0.99 0.99", "0.85 0.89 0.86"));
  content.push(...drawText("CATEGORY BREAKDOWN", 54, 588, 10, true, "0.07 0.29 0.15"));
  let yCursor = 568;
  for (const row of categoryScores) {
    content.push(...drawText(row.label, 54, yCursor, 9, true));
    content.push(...drawText(`${Math.round(row.value)}%`, 215, yCursor, 9, true));
    content.push(...drawProgress(250, yCursor - 3, 290, 9, row.value, row.color));
    yCursor -= 20;
  }

  content.push(...drawRect(42, 357, 161, 108, "0.95 0.99 0.96", "0.79 0.89 0.82"));
  content.push(...drawText("STRENGTHS", 54, 447, 10, true, "0.07 0.41 0.20"));
  let strengthY = 431;
  for (const item of strengths) {
    const lines = wrapText(item, 28);
    content.push(...drawText("✓", 54, strengthY, 10, true, "0.08 0.62 0.27"));
    for (const line of lines) {
      content.push(...drawText(line, 68, strengthY, 8));
      strengthY -= 11;
    }
    strengthY -= 2;
  }

  content.push(...drawRect(217, 357, 161, 108, "1.00 0.98 0.93", "0.95 0.78 0.35"));
  content.push(...drawText("READINESS GAPS", 229, 447, 10, true, "0.73 0.45 0.03"));
  let gapY = 431;
  for (const item of gaps) {
    const lines = wrapText(item, 28);
    content.push(...drawText("!", 229, gapY, 10, true, "0.92 0.63 0.12"));
    for (const line of lines) {
      content.push(...drawText(line, 241, gapY, 8));
      gapY -= 11;
    }
    gapY -= 2;
  }

  content.push(...drawRect(392, 357, 161, 108, "1.00 0.95 0.95", "0.93 0.68 0.68"));
  content.push(...drawText("RISK FLAGS", 404, 447, 10, true, "0.75 0.13 0.13"));
  content.push(...drawRect(404, 370, 137, 62, "1.00 0.97 0.97", "0.93 0.78 0.78"));
  let riskY = 418;
  for (const line of wrapText(`Risk Flag: ${riskMessage}`, 31)) {
    content.push(...drawText(line, 410, riskY, 8, false, "0.70 0.11 0.11"));
    riskY -= 11;
  }

  content.push(...drawRect(42, 263, 511, 84, "0.99 1.00 0.99", "0.85 0.89 0.86"));
  content.push(...drawText("RECOMMENDED NEXT ACTIONS", 54, 331, 10, true, "0.07 0.29 0.15"));
  content.push(...drawText("Priority Actions (next 30 days)", 54, 313, 9, true, "0.09 0.42 0.22"));
  content.push(...drawText("Medium-term Actions (90 days)", 228, 313, 9, true, "0.48 0.36 0.10"));
  content.push(...drawText("Investor-grade Improvements (6 months)", 390, 313, 9, true, "0.09 0.42 0.22"));
  const col1 = ["File outstanding tax returns", "Resolve compliance issues"];
  const col2 = ["Improve cashflow documentation", "Maintain consistent records"];
  const col3 = ["Develop detailed business plan", "Build investor-ready pitch deck"];
  let actionY = 299;
  for (const line of col1) {
    content.push(...drawText(`- ${line}`, 54, actionY, 8));
    actionY -= 11;
  }
  actionY = 299;
  for (const line of col2) {
    content.push(...drawText(`- ${line}`, 228, actionY, 8));
    actionY -= 11;
  }
  actionY = 299;
  for (const line of col3) {
    content.push(...drawText(`- ${line}`, 390, actionY, 8));
    actionY -= 11;
  }

  content.push(...drawRect(42, 178, 511, 76, "0.97 0.99 0.98", "0.85 0.89 0.86"));
  content.push(...drawText("FUNDING SIGNAL SUMMARY", 54, 238, 10, true, "0.07 0.29 0.15"));
  content.push(...drawText(`Recommended funding type: ${fundingType}`, 54, 220, 10, true, "0.09 0.42 0.22"));
  content.push(...drawText(`Estimated readiness confidence: ${confidence}`, 54, 204, 9, false));

  content.push(...drawRect(445, 188, 96, 56, "1 1 1", "0.80 0.85 0.82"));
  content.push(...drawText("VERIFY", 478, 231, 8, true, "0.15 0.26 0.20"));
  content.push(...drawRect(456, 198, 30, 30, "0.95 0.95 0.95", "0.55 0.55 0.55"));
  content.push(...drawText("QR", 466, 211, 10, true, "0.35 0.35 0.35"));
  content.push(...drawText("Scan to verify", 492, 214, 7, false, "0.30 0.36 0.33"));
  content.push(...drawText(detail.resolvedId, 492, 202, 6, false, "0.30 0.36 0.33"));

  content.push(...drawRect(30, 30, 535, 28, "0.04 0.36 0.18"));
  content.push(...drawText("Generated by: Digital Business Identity Network (DBIN)", 42, 45, 8, false, "0.90 0.96 0.92"));
  content.push(
    ...drawText(
      "This report summarizes business readiness indicators from submitted disclosures and platform signals.",
      42,
      34,
      7,
      false,
      "0.83 0.94 0.87"
    )
  );
  content.push(...drawText(verificationUrl, 388, 34, 6, false, "0.83 0.94 0.87"));

  const contentStream = content.join("\n");

  const streamLength = new TextEncoder().encode(contentStream).length;
  const objects = [
    "1 0 obj << /Type /Catalog /Pages 2 0 R >> endobj",
    "2 0 obj << /Type /Pages /Kids [3 0 R] /Count 1 >> endobj",
    "3 0 obj << /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Resources << /Font << /F1 4 0 R /F2 5 0 R >> >> /Contents 6 0 R >> endobj",
    "4 0 obj << /Type /Font /Subtype /Type1 /BaseFont /Helvetica >> endobj",
    "5 0 obj << /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold >> endobj",
    `6 0 obj << /Length ${streamLength} >> stream\n${contentStream}\nendstream endobj`,
  ];

  let pdf = "%PDF-1.4\n";
  const offsets: number[] = [0];
  for (const object of objects) {
    offsets.push(new TextEncoder().encode(pdf).length);
    pdf += `${object}\n`;
  }

  const xrefStart = new TextEncoder().encode(pdf).length;
  pdf += `xref\n0 ${objects.length + 1}\n`;
  pdf += "0000000000 65535 f \n";
  for (const offset of offsets.slice(1)) {
    pdf += `${offset.toString().padStart(10, "0")} 00000 n \n`;
  }
  pdf += `trailer << /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xrefStart}\n%%EOF`;

  const bytes = new TextEncoder().encode(pdf);

  return new Response(bytes, {
    status: 200,
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `inline; filename="verification-summary-${detail.resolvedId}.pdf"`,
      "Cache-Control": "no-store",
    },
  });
}
