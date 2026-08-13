const PLACEHOLDER_PATTERN = /\{\{\s*([a-zA-Z0-9_.-]+)\s*\}\}/g;

export function extractTemplatePlaceholders(body: string) {
  return Array.from(new Set(Array.from(body.matchAll(PLACEHOLDER_PATTERN)).map((match) => match[1]).filter(Boolean))).sort();
}

export function requiredTemplatePlaceholders(schema: unknown) {
  if (!schema || typeof schema !== "object") return [];
  const required = (schema as { required?: unknown }).required;
  if (!Array.isArray(required)) return [];
  return required.map((value) => String(value).trim()).filter(Boolean).sort();
}

export function validateTemplatePlaceholders(body: string, schema: unknown) {
  const present = extractTemplatePlaceholders(body);
  const required = requiredTemplatePlaceholders(schema);
  const missing = required.filter((placeholder) => !present.includes(placeholder));
  return {
    ok: missing.length === 0,
    present,
    required,
    missing,
  };
}

export function parsePlaceholderSchema(input: string | null | undefined) {
  const trimmed = String(input ?? "").trim();
  if (!trimmed) return { required: [] };
  try {
    const parsed = JSON.parse(trimmed);
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) throw new Error("Schema must be a JSON object.");
    return parsed as Record<string, unknown>;
  } catch (error) {
    throw new Error(`Invalid placeholder schema: ${error instanceof Error ? error.message : "unable to parse JSON"}`);
  }
}

export function renderTemplatePreview(body: string, values: Record<string, string>) {
  return body.replace(PLACEHOLDER_PATTERN, (_match, key: string) => values[key] ?? `[${key}]`);
}
