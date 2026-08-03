#!/usr/bin/env python3
"""Extract LCDBO RMRDC LGA resource source rows into a reviewable JSON artifact.

This intentionally preserves source wording and page provenance. It does not
select anchor products or publish clusters.
"""

from __future__ import annotations

import argparse
import json
import re
from collections import Counter
from pathlib import Path

import pdfplumber


STATE_HEADING_MAP = {
    "ABIA STATE": "Abia",
    "ADAMAWA STATE": "Adamawa",
    "AKWA IBOM STATE": "Akwa Ibom",
    "IBOM STATE": "Akwa Ibom",
    "ANAMBRA STATE": "Anambra",
    "BAUCHI STATE": "Bauchi",
    "BAYELSA STATE": "Bayelsa",
    "BENUE STATE": "Benue",
    "BORNO STATE": "Borno",
    "CROSS RIVER STATE": "Cross River",
    "RIVER STATE": "Cross River",
    "DELTA STATE": "Delta",
    "EBONYI STATE": "Ebonyi",
    "EDO STATE": "Edo",
    "EKITI STATE": "Ekiti",
    "ENUGU STATE": "Enugu",
    "GOMBE STATE": "Gombe",
    "IMO STATE": "Imo",
    "JIGAWA STATE": "Jigawa",
    "KADUNA STATE": "Kaduna",
    "KANO STATE": "Kano",
    "KATSINA STATE": "Katsina",
    "KEBBI STATE": "Kebbi",
    "KOGI STATE": "Kogi",
    "KWARA STATE": "Kwara",
    "LAGOS STATE": "Lagos",
    "NASSARAWA STATE": "Nasarawa",
    "NASARAWA STATE": "Nasarawa",
    "NIGER STATE": "Niger",
    "OGUN STATE": "Ogun",
    "ONDO STATE": "Ondo",
    "OSUN STATE": "Osun",
    "OYO STATE": "Oyo",
    "PLATEAU STATE": "Plateau",
    "RIVERS STATE": "Rivers",
    "SOKOTO STATE": "Sokoto",
    "TARABA STATE": "Taraba",
    "YOBE STATE": "Yobe",
    "ZAMFARA STATE": "Zamfara",
    "FCT": "Federal Capital Territory",
    "FEDERAL CAPITAL TERRITORY": "Federal Capital Territory",
}

STATE_HEADING_PATTERN = re.compile(r"\b(?:AKWA\s+)?[A-Z][A-Z ]+ STATE\b|\bFEDERAL CAPITAL TERRITORY\b|\bFCT\b")
ROW_START_PATTERN = re.compile(r"(?m)^\s*\d+\.\s+")


def normalise_space(value: str) -> str:
    return re.sub(r"\s+", " ", value).strip()


def display_lga_label(value: str) -> str:
    return value.title().replace(" Lga", " LGA").replace(" Fct", " FCT")


def split_lga_and_body(value: str) -> tuple[str, str, str]:
    match = re.match(r"([A-Z][A-Z0-9 /\-()]+?)(?=\s+[A-Z][a-z])\s+(.+)", value)
    if match:
        return match.group(1).strip(" ,.-"), match.group(2).strip(), "medium"

    parts = value.split(" ", 3)
    label = " ".join(parts[:2]).strip(" ,.-") if len(parts) > 2 else value[:60].strip(" ,.-")
    return label, value[len(label):].strip(), "requires_review"


def extract_rows(input_pdf: Path) -> tuple[list[dict], dict]:
    rows: list[dict] = []
    current_heading: str | None = None
    current_state: str | None = None
    seen_source_row_ids: set[str] = set()

    with pdfplumber.open(input_pdf) as pdf:
        for page_number, page in enumerate(pdf.pages, 1):
            text = page.extract_text() or ""
            headings = [
                (match.start(), match.group(0).strip())
                for match in STATE_HEADING_PATTERN.finditer(text)
                if match.group(0).strip() in STATE_HEADING_MAP
            ]
            starts = [match.start() for match in ROW_START_PATTERN.finditer(text)]
            starts.append(len(text))

            for index, start in enumerate(starts[:-1]):
                for position, heading in headings:
                    if position <= start:
                        current_heading = heading
                        current_state = STATE_HEADING_MAP[heading]

                chunk = normalise_space(text[start : starts[index + 1]])
                chunk = re.sub(
                    r"S/N LOCAL GOVT\. RAW MAERIALS RESOURCE BASED INVESTMENT\s+AREA OPPORTUNITIES\s*",
                    " ",
                    chunk,
                )
                chunk = normalise_space(chunk)
                row_match = re.match(r"(\d+)\.\s+(.+)", chunk)
                if not row_match:
                    continue

                serial = int(row_match.group(1))
                source_lga_original, material_opportunity_text, confidence = split_lga_and_body(row_match.group(2))
                source_row_id = f"rmrdc-2017-p{page_number:03d}-r{serial:03d}"
                if source_row_id in seen_source_row_ids:
                    continue
                seen_source_row_ids.add(source_row_id)
                rows.append(
                    {
                        "source_row_id": source_row_id,
                        "source_document_key": "rmrdc_lga_investment_opportunities_2017",
                        "source_page": page_number,
                        "source_serial": serial,
                        "source_state_label": current_heading,
                        "normalised_state": current_state,
                        "source_lga_label": display_lga_label(source_lga_original),
                        "source_lga_label_original": source_lga_original,
                        "source_text": chunk,
                        "source_material_and_opportunity_text": material_opportunity_text,
                        "extraction_status": "extracted",
                        "extraction_confidence": confidence,
                        "source_classification": "RMRDC Reference Source — 2017",
                    }
                )

    state_counts = Counter(row["normalised_state"] or "Unassigned" for row in rows)
    metadata = {
        "source_document_key": "rmrdc_lga_investment_opportunities_2017",
        "title": "Investment Profiles of Projects and Potential Investment Opportunities Based on Local Government Areas/Wards of Nigeria",
        "source_institution": "Raw Materials Research and Development Council",
        "prepared_by": "Gabmarole Nigeria Limited",
        "publication_month": "August 2017",
        "extraction_method": "pdfplumber text extraction with row-boundary preservation",
        "extraction_limitations": [
            "PDF text extraction does not reliably preserve table column boundaries on every page.",
            "Rows preserve original source wording and require institutional review before anchor-product approval.",
            "The source lists multiple raw materials and investment opportunities per LGA-like row.",
        ],
        "artifact_version": "2026-08-03",
        "pdf_pages": 235,
        "source_row_count": len(rows),
        "state_fct_coverage_count": len([state for state in state_counts if state != "Unassigned"]),
        "state_counts": dict(sorted(state_counts.items())),
    }
    return rows, metadata


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("input_pdf", type=Path)
    parser.add_argument("output_json", type=Path)
    args = parser.parse_args()

    rows, metadata = extract_rows(args.input_pdf)
    args.output_json.parent.mkdir(parents=True, exist_ok=True)
    args.output_json.write_text(json.dumps({"metadata": metadata, "rows": rows}, indent=2, ensure_ascii=False) + "\n")
    print(json.dumps({"output": str(args.output_json), "rows": len(rows), "states": metadata["state_fct_coverage_count"]}, indent=2))


if __name__ == "__main__":
    main()
