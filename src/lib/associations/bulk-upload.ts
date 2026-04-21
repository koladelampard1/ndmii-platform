import { SUPPORTED_MSME_SECTORS } from "@/lib/constants/sectors";

export const BULK_UPLOAD_COLUMNS = [
  "business_name",
  "owner_full_name",
  "phone",
  "email",
  "category",
  "subcategory",
  "location",
  "association_member_id",
  "cac_number",
  "tin",
  "address",
] as const;

export type UploadColumn = (typeof BULK_UPLOAD_COLUMNS)[number];

export type RawUploadRow = Record<string, string>;

export type ValidatedUploadRow = {
  rowNumber: number;
  values: RawUploadRow;
  errors: string[];
  normalizedEmail: string;
  normalizedPhone: string;
};

function splitCsvLine(line: string) {
  const result: string[] = [];
  let current = "";
  let inQuotes = false;

  for (let i = 0; i < line.length; i += 1) {
    const char = line[i];
    if (char === '"') {
      if (inQuotes && line[i + 1] === '"') {
        current += '"';
        i += 1;
      } else {
        inQuotes = !inQuotes;
      }
      continue;
    }

    if (char === "," && !inQuotes) {
      result.push(current.trim());
      current = "";
      continue;
    }

    current += char;
  }

  result.push(current.trim());
  return result;
}

export function parseCsvContent(csvContent: string): { headers: string[]; rows: RawUploadRow[] } {
  const lines = csvContent
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);

  if (lines.length === 0) {
    return { headers: [], rows: [] };
  }

  const headers = splitCsvLine(lines[0]).map((header) => header.toLowerCase());

  const rows = lines.slice(1).map((line) => {
    const cells = splitCsvLine(line);
    return headers.reduce<RawUploadRow>((acc, header, index) => {
      acc[header] = String(cells[index] ?? "").trim();
      return acc;
    }, {});
  });

  return { headers, rows };
}

function normalizePhone(phone: string) {
  return phone.replace(/\s+/g, "").replace(/[^+\d]/g, "");
}

function isEmailValid(email: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

function isPhoneValid(phone: string) {
  const normalized = normalizePhone(phone);
  return /^(\+?\d{10,15})$/.test(normalized);
}

export function validateUploadRows({
  rows,
  categories,
  locations,
}: {
  rows: RawUploadRow[];
  categories: string[];
  locations: string[];
}) {
  const duplicateEmailTracker = new Map<string, number[]>();
  const duplicatePhoneTracker = new Map<string, number[]>();

  const normalizedCategories = new Set(
    [...categories, ...SUPPORTED_MSME_SECTORS].map((item) => item.trim().toLowerCase()).filter(Boolean),
  );
  const normalizedLocations = new Set(locations.map((item) => item.trim().toLowerCase()).filter(Boolean));

  const validated = rows.map<ValidatedUploadRow>((values, index) => {
    const rowNumber = index + 2;
    const errors: string[] = [];

    const requiredFields: UploadColumn[] = ["business_name", "owner_full_name", "phone", "email", "category", "location"];

    for (const field of requiredFields) {
      if (!String(values[field] ?? "").trim()) {
        errors.push(`${field} is required`);
      }
    }

    const email = String(values.email ?? "").trim().toLowerCase();
    const phone = normalizePhone(String(values.phone ?? ""));
    const category = String(values.category ?? "").trim().toLowerCase();
    const location = String(values.location ?? "").trim().toLowerCase();

    if (email && !isEmailValid(email)) {
      errors.push("email format is invalid");
    }

    if (phone && !isPhoneValid(phone)) {
      errors.push("phone format is invalid");
    }

    if (category && normalizedCategories.size > 0 && !normalizedCategories.has(category)) {
      errors.push("category does not exist");
    }

    if (location && normalizedLocations.size > 0 && !normalizedLocations.has(location)) {
      errors.push("location does not exist");
    }

    if (email) {
      duplicateEmailTracker.set(email, [...(duplicateEmailTracker.get(email) ?? []), rowNumber]);
    }

    if (phone) {
      duplicatePhoneTracker.set(phone, [...(duplicatePhoneTracker.get(phone) ?? []), rowNumber]);
    }

    return {
      rowNumber,
      values,
      errors,
      normalizedEmail: email,
      normalizedPhone: phone,
    };
  });

  for (const item of validated) {
    if (item.normalizedEmail && (duplicateEmailTracker.get(item.normalizedEmail)?.length ?? 0) > 1) {
      item.errors.push("duplicate email detected in upload file");
    }
    if (item.normalizedPhone && (duplicatePhoneTracker.get(item.normalizedPhone)?.length ?? 0) > 1) {
      item.errors.push("duplicate phone detected in upload file");
    }
  }

  const validRows = validated.filter((row) => row.errors.length === 0);
  const invalidRows = validated.filter((row) => row.errors.length > 0);

  return {
    validRows,
    invalidRows,
    allRows: validated,
  };
}

export function toCsvDownload(rows: Array<Record<string, string | number>>) {
  if (!rows.length) return "";

  const headers = Object.keys(rows[0]);
  const escapeCsv = (value: string | number) => {
    const raw = String(value ?? "");
    if (raw.includes(",") || raw.includes('"') || raw.includes("\n")) {
      return `"${raw.replaceAll('"', '""')}"`;
    }
    return raw;
  };

  const body = rows.map((row) => headers.map((header) => escapeCsv(row[header] ?? "")).join(",")).join("\n");
  return `${headers.join(",")}\n${body}`;
}
