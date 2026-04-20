import { NextResponse } from "next/server";
import { BULK_UPLOAD_COLUMNS } from "@/lib/associations/bulk-upload";

export async function GET() {
  const csvHeader = BULK_UPLOAD_COLUMNS.join(",");
  const sampleRow = [
    "Arewa Metal Works",
    "Yusuf Ibrahim",
    "+2348030001111",
    "yusuf@arewametal.ng",
    "Manufacturing",
    "Metal Fabrication",
    "Abuja",
    "ABJ-ART-001",
    "CAC-ABJ-10932",
    "TIN-8832901",
    "Plot 18, Dei-Dei Industrial Layout, Abuja",
  ].join(",");

  const body = `${csvHeader}\n${sampleRow}\n`;

  return new NextResponse(body, {
    status: 200,
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": 'attachment; filename="ndmii-msme-upload-template.csv"',
    },
  });
}
