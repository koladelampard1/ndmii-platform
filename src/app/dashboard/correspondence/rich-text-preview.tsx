import { correspondenceRichTextFromContent, type CorrespondenceRichTextRun } from "@/lib/lcdbo-correspondence/rich-text";

function RichRun({ run }: { run: CorrespondenceRichTextRun }) {
  return (
    <span style={{ fontFamily: run.font === "serif" ? "Georgia, serif" : run.font === "mono" ? "ui-monospace, monospace" : "Inter, sans-serif", fontWeight: run.bold ? 700 : undefined, fontStyle: run.italic ? "italic" : undefined, textDecoration: run.underline ? "underline" : undefined }}>
      {run.text}
    </span>
  );
}

export function CorrespondenceRichTextPreview({ content, fallback }: { content: unknown; fallback: string }) {
  const document = correspondenceRichTextFromContent(content, fallback);
  return (
    <div className="mt-4 max-h-[32rem] overflow-auto rounded-xl bg-white p-4 text-sm leading-7 text-slate-700 ring-1 ring-slate-200">
      {document.blocks.map((block, index) => {
        const lastNonNumberIndex = document.blocks.slice(0, index).map((item) => item.type === "number").lastIndexOf(false);
        const orderedIndex = index - lastNonNumberIndex;
        const contentRuns = block.runs.map((run, runIndex) => <RichRun key={runIndex} run={run} />);
        const style = { textAlign: block.align ?? "left" } as const;
        if (block.type === "heading") return <h3 key={index} className="mb-2 mt-4 text-base font-bold text-slate-950" style={style}>{contentRuns}</h3>;
        if (block.type === "bullet") return <div key={index} className="flex gap-2 pl-2" style={style}><span aria-hidden="true">•</span><p>{contentRuns}</p></div>;
        if (block.type === "number") return <div key={index} className="flex gap-2 pl-2" style={style}><span className="font-bold" aria-hidden="true">{orderedIndex}.</span><p>{contentRuns}</p></div>;
        return <p key={index} className="my-2 min-h-3" style={style}>{contentRuns}</p>;
      })}
    </div>
  );
}
