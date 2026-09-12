export const CORRESPONDENCE_RICH_TEXT_VERSION = 1 as const;

export type CorrespondenceRichTextFont = "inter" | "serif" | "mono";
export type CorrespondenceRichTextAlign = "left" | "center" | "right";
export type CorrespondenceRichTextBlockType = "paragraph" | "heading" | "bullet" | "number";

export type CorrespondenceRichTextRun = {
  text: string;
  bold?: boolean;
  italic?: boolean;
  underline?: boolean;
  font?: CorrespondenceRichTextFont;
};

export type CorrespondenceRichTextBlock = {
  type: CorrespondenceRichTextBlockType;
  align?: CorrespondenceRichTextAlign;
  runs: CorrespondenceRichTextRun[];
};

export type CorrespondenceRichTextDocument = {
  version: typeof CORRESPONDENCE_RICH_TEXT_VERSION;
  blocks: CorrespondenceRichTextBlock[];
};

const BLOCK_TYPES = new Set<CorrespondenceRichTextBlockType>(["paragraph", "heading", "bullet", "number"]);
const ALIGNMENTS = new Set<CorrespondenceRichTextAlign>(["left", "center", "right"]);
const FONTS = new Set<CorrespondenceRichTextFont>(["inter", "serif", "mono"]);
const MAX_BLOCKS = 300;
const MAX_RUNS_PER_BLOCK = 200;
const MAX_TEXT_LENGTH = 50_000;

function cleanText(value: unknown) {
  return String(value ?? "").replace(/\r/g, "").replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, "");
}

export function plainTextToRichText(value: string): CorrespondenceRichTextDocument {
  const blocks = cleanText(value).split("\n").map((line) => {
    const trimmed = line.trim();
    const bullet = /^[-*•]\s+/.test(trimmed);
    const numbered = /^\d+[.)]\s+/.test(trimmed);
    const content = trimmed.replace(/^[-*•]\s+/, "").replace(/^\d+[.)]\s+/, "");
    return {
      type: bullet ? "bullet" : numbered ? "number" : "paragraph",
      align: "left",
      runs: [{ text: content }],
    } satisfies CorrespondenceRichTextBlock;
  });
  return { version: CORRESPONDENCE_RICH_TEXT_VERSION, blocks };
}

export function parseCorrespondenceRichText(value: unknown, fallback = ""): CorrespondenceRichTextDocument {
  if (typeof value !== "string" || !value.trim()) return plainTextToRichText(fallback);
  let parsed: unknown;
  try {
    parsed = JSON.parse(value);
  } catch {
    return plainTextToRichText(fallback);
  }
  if (!parsed || typeof parsed !== "object" || !Array.isArray((parsed as { blocks?: unknown }).blocks)) return plainTextToRichText(fallback);
  let totalLength = 0;
  const blocks: CorrespondenceRichTextBlock[] = [];
  for (const rawBlock of (parsed as { blocks: unknown[] }).blocks.slice(0, MAX_BLOCKS)) {
    if (!rawBlock || typeof rawBlock !== "object") continue;
    const candidate = rawBlock as { type?: unknown; align?: unknown; runs?: unknown };
    const type = BLOCK_TYPES.has(candidate.type as CorrespondenceRichTextBlockType) ? candidate.type as CorrespondenceRichTextBlockType : "paragraph";
    const align = ALIGNMENTS.has(candidate.align as CorrespondenceRichTextAlign) ? candidate.align as CorrespondenceRichTextAlign : "left";
    const rawRuns = Array.isArray(candidate.runs) ? candidate.runs.slice(0, MAX_RUNS_PER_BLOCK) : [];
    const runs: CorrespondenceRichTextRun[] = [];
    for (const rawRun of rawRuns) {
      if (!rawRun || typeof rawRun !== "object") continue;
      const run = rawRun as Record<string, unknown>;
      const remaining = MAX_TEXT_LENGTH - totalLength;
      if (remaining <= 0) break;
      const text = cleanText(run.text).slice(0, remaining);
      totalLength += text.length;
      if (!text) continue;
      runs.push({
        text,
        bold: run.bold === true || undefined,
        italic: run.italic === true || undefined,
        underline: run.underline === true || undefined,
        font: FONTS.has(run.font as CorrespondenceRichTextFont) ? run.font as CorrespondenceRichTextFont : "inter",
      });
    }
    blocks.push({ type, align, runs });
  }
  return blocks.length ? { version: CORRESPONDENCE_RICH_TEXT_VERSION, blocks } : plainTextToRichText(fallback);
}

export function correspondenceRichTextToPlainText(document: CorrespondenceRichTextDocument) {
  let orderedIndex = 0;
  return document.blocks.map((block) => {
    const text = block.runs.map((run) => run.text).join("").trim();
    if (block.type === "bullet") {
      orderedIndex = 0;
      return text ? `- ${text}` : "";
    }
    if (block.type === "number") {
      orderedIndex += 1;
      return text ? `${orderedIndex}. ${text}` : "";
    }
    orderedIndex = 0;
    return text;
  }).join("\n").trim();
}

export function correspondenceRichTextFromContent(content: unknown, fallback = "") {
  const richBody = content && typeof content === "object" ? (content as Record<string, unknown>).rich_body : null;
  return parseCorrespondenceRichText(typeof richBody === "string" ? richBody : JSON.stringify(richBody ?? ""), fallback);
}

export function serializeCorrespondenceRichText(document: CorrespondenceRichTextDocument) {
  return JSON.stringify(document);
}
