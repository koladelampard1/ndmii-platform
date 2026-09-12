"use client";

import { useMemo, useRef, useState } from "react";
import {
  correspondenceRichTextToPlainText,
  parseCorrespondenceRichText,
  serializeCorrespondenceRichText,
  type CorrespondenceRichTextAlign,
  type CorrespondenceRichTextBlock,
  type CorrespondenceRichTextDocument,
  type CorrespondenceRichTextFont,
  type CorrespondenceRichTextRun,
} from "@/lib/lcdbo-correspondence/rich-text";

type InlineStyle = Pick<CorrespondenceRichTextRun, "bold" | "italic" | "underline" | "font">;

function fontFromElement(element: Element, inherited: CorrespondenceRichTextFont): CorrespondenceRichTextFont {
  const face = (element.getAttribute("face") ?? (element as HTMLElement).style.fontFamily ?? "").toLowerCase();
  if (face.includes("times") || face.includes("georgia") || face.includes("serif")) return "serif";
  if (face.includes("courier") || face.includes("mono")) return "mono";
  return inherited;
}

function collectRuns(node: Node, style: InlineStyle = { font: "inter" }): CorrespondenceRichTextRun[] {
  if (node.nodeType === Node.TEXT_NODE) return node.textContent ? [{ text: node.textContent, ...style }] : [];
  if (!(node instanceof Element)) return [];
  if (node.tagName === "BR") return [{ text: "\n", ...style }];
  const next: InlineStyle = {
    bold: style.bold || ["B", "STRONG"].includes(node.tagName) || (node as HTMLElement).style.fontWeight === "bold" || undefined,
    italic: style.italic || ["I", "EM"].includes(node.tagName) || (node as HTMLElement).style.fontStyle === "italic" || undefined,
    underline: style.underline || node.tagName === "U" || (node as HTMLElement).style.textDecoration.includes("underline") || undefined,
    font: fontFromElement(node, style.font ?? "inter"),
  };
  return Array.from(node.childNodes).flatMap((child) => collectRuns(child, next));
}

function alignmentFor(element: Element): CorrespondenceRichTextAlign {
  const value = ((element as HTMLElement).style.textAlign || element.getAttribute("align") || "left").toLowerCase();
  return value === "center" || value === "right" ? value : "left";
}

function documentFromEditor(root: HTMLElement): CorrespondenceRichTextDocument {
  const blocks: CorrespondenceRichTextBlock[] = [];
  const addBlock = (element: Element, type: CorrespondenceRichTextBlock["type"]) => {
    blocks.push({ type, align: alignmentFor(element), runs: collectRuns(element) });
  };
  for (const node of Array.from(root.childNodes)) {
    if (node.nodeType === Node.TEXT_NODE) {
      if (node.textContent?.trim()) blocks.push({ type: "paragraph", align: "left", runs: [{ text: node.textContent, font: "inter" }] });
      continue;
    }
    if (!(node instanceof Element)) continue;
    if (node.tagName === "UL" || node.tagName === "OL") {
      for (const item of Array.from(node.children)) if (item.tagName === "LI") addBlock(item, node.tagName === "UL" ? "bullet" : "number");
      continue;
    }
    addBlock(node, ["H1", "H2", "H3"].includes(node.tagName) ? "heading" : "paragraph");
  }
  return { version: 1, blocks: blocks.length ? blocks : [{ type: "paragraph", align: "left", runs: [] }] };
}

function EditableBlocks({ document }: { document: CorrespondenceRichTextDocument }) {
  let orderedIndex = 0;
  return document.blocks.map((block, index) => {
    if (block.type === "number") orderedIndex += 1;
    else orderedIndex = 0;
    const content = block.runs.map((run, runIndex) => (
      <span key={runIndex} style={{ fontFamily: run.font === "serif" ? "Georgia, serif" : run.font === "mono" ? "ui-monospace, monospace" : "Inter, sans-serif", fontWeight: run.bold ? 700 : undefined, fontStyle: run.italic ? "italic" : undefined, textDecoration: run.underline ? "underline" : undefined }}>{run.text}</span>
    ));
    if (block.type === "heading") return <h2 key={index} style={{ textAlign: block.align }}>{content}</h2>;
    if (block.type === "bullet") return <ul key={index} style={{ textAlign: block.align }}><li>{content}</li></ul>;
    if (block.type === "number") return <ol key={index} start={orderedIndex} style={{ textAlign: block.align }}><li>{content}</li></ol>;
    return <p key={index} style={{ textAlign: block.align }}>{content.length ? content : <br />}</p>;
  });
}

export function CorrespondenceRichTextEditor({ initialBody = "", initialRichBody, label = "Body" }: { initialBody?: string; initialRichBody?: unknown; label?: string }) {
  const initialDocument = useMemo(() => parseCorrespondenceRichText(typeof initialRichBody === "string" ? initialRichBody : JSON.stringify(initialRichBody ?? ""), initialBody), [initialBody, initialRichBody]);
  const editorRef = useRef<HTMLDivElement>(null);
  const [richDocument, setRichDocument] = useState(initialDocument);

  const sync = () => {
    if (editorRef.current) setRichDocument(documentFromEditor(editorRef.current));
  };
  const command = (name: string, value?: string) => {
    editorRef.current?.focus();
    window.document.execCommand(name, false, value);
    sync();
  };
  const buttonClass = "rounded-lg border border-slate-300 bg-white px-2.5 py-1.5 text-xs font-bold text-slate-700 hover:bg-slate-100";

  return (
    <div className="md:col-span-2">
      <p className="text-sm font-bold text-slate-700">{label}</p>
      <div className="mt-1 overflow-hidden rounded-xl border border-slate-200 bg-white focus-within:ring-2 focus-within:ring-emerald-500">
        <div className="flex flex-wrap items-center gap-1 border-b border-slate-200 bg-slate-50 p-2" role="toolbar" aria-label="Letter formatting">
          <button type="button" className={buttonClass} onMouseDown={(event) => { event.preventDefault(); command("formatBlock", "p"); }}>Paragraph</button>
          <button type="button" className={buttonClass} onMouseDown={(event) => { event.preventDefault(); command("formatBlock", "h2"); }}>Heading</button>
          <button type="button" className={buttonClass} onMouseDown={(event) => { event.preventDefault(); command("bold"); }} aria-label="Bold"><strong>B</strong></button>
          <button type="button" className={buttonClass} onMouseDown={(event) => { event.preventDefault(); command("italic"); }} aria-label="Italic"><em>I</em></button>
          <button type="button" className={buttonClass} onMouseDown={(event) => { event.preventDefault(); command("underline"); }} aria-label="Underline"><span className="underline">U</span></button>
          <button type="button" className={buttonClass} onMouseDown={(event) => { event.preventDefault(); command("insertUnorderedList"); }}>Bullets</button>
          <button type="button" className={buttonClass} onMouseDown={(event) => { event.preventDefault(); command("insertOrderedList"); }}>Numbering</button>
          <button type="button" className={buttonClass} onMouseDown={(event) => { event.preventDefault(); command("justifyLeft"); }}>Left</button>
          <button type="button" className={buttonClass} onMouseDown={(event) => { event.preventDefault(); command("justifyCenter"); }}>Centre</button>
          <button type="button" className={buttonClass} onMouseDown={(event) => { event.preventDefault(); command("justifyRight"); }}>Right</button>
          <select aria-label="Font" defaultValue="Inter" className="rounded-lg border border-slate-300 bg-white px-2 py-1.5 text-xs font-bold text-slate-700" onChange={(event) => command("fontName", event.target.value)}>
            <option value="Inter">Inter</option>
            <option value="Georgia">Serif</option>
            <option value="Courier New">Monospace</option>
          </select>
          <button type="button" className={buttonClass} onMouseDown={(event) => { event.preventDefault(); command("removeFormat"); }}>Clear format</button>
        </div>
        <div ref={editorRef} contentEditable suppressContentEditableWarning onInput={sync} className="min-h-72 px-4 py-3 text-sm leading-7 text-slate-900 outline-none [&_h2]:my-3 [&_h2]:text-lg [&_h2]:font-bold [&_ol]:my-2 [&_ol]:list-decimal [&_ol]:pl-6 [&_p]:my-2 [&_ul]:my-2 [&_ul]:list-disc [&_ul]:pl-6" aria-label={label} aria-required="true">
          <EditableBlocks document={initialDocument} />
        </div>
      </div>
      <p className="mt-1 text-xs text-slate-500">Formatting is preserved in the draft and final PDF. Pasted unsupported styling is removed when saved.</p>
      <input type="hidden" name="body" value={correspondenceRichTextToPlainText(richDocument)} />
      <input type="hidden" name="body_rich_text" value={serializeCorrespondenceRichText(richDocument)} />
    </div>
  );
}
