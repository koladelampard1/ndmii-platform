const FORMULA_PREFIX_PATTERN = /^[=+\-@]/;

export function neutralizeCsvFormula(value: string) {
  const normalized = value.replace(/\r\n/g, "\n").replace(/\r/g, "\n");
  const trimmedStart = normalized.trimStart();
  if (FORMULA_PREFIX_PATTERN.test(trimmedStart)) return `'${normalized}`;
  return normalized;
}

export function escapeCsvValue(value: unknown) {
  const safe = neutralizeCsvFormula(String(value ?? ""));
  return `"${safe.replace(/"/g, '""')}"`;
}

export function toCsv(headers: readonly string[], rows: readonly (readonly unknown[])[]) {
  return [
    headers.map(escapeCsvValue).join(","),
    ...rows.map((row) => row.map(escapeCsvValue).join(",")),
  ].join("\n");
}

