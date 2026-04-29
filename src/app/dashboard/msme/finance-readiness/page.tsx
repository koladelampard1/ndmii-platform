"use client";

import { useMemo, useState } from "react";
import QRCode from "qrcode";
import { ArrowLeft, ArrowRight, CheckCircle2, Download, Landmark, TrendingUp, Wallet } from "lucide-react";

type Pathway = "loan" | "grant" | "investment";
type Answer = "yes" | "no" | null;
type Question = { id: string; label: string; helper: string };
type Section = { id: string; title: string; questions: Question[] };

const sections: Section[] = [
  { id: "identity", title: "Identity & Compliance", questions: [
    { id: "nin_bvn", label: "Do you have verified NIN/BVN records linked to the business?", helper: "Identity validation is required before financing." },
    { id: "cac", label: "Is your CAC registration active and up to date?", helper: "Updated registration improves trust and approval speed." },
    { id: "tin", label: "Do you have an active TIN and basic filing history?", helper: "Tax traceability is a core compliance signal." },
  ]},
  { id: "financial", title: "Financial Records", questions: [
    { id: "bank_stmt", label: "Can you provide 12 months of bank statements?", helper: "Cashflow evidence supports affordability checks." },
    { id: "bookkeeping", label: "Do you keep monthly profit/loss and expense records?", helper: "Consistent records improve underwriting confidence." },
    { id: "separation", label: "Do you separate business and personal finances?", helper: "Separate accounts enable clearer analysis." },
  ]},
  { id: "operations", title: "Business Operations", questions: [
    { id: "capacity", label: "Can operations support higher order volume?", helper: "Funders test your ability to absorb capital." },
    { id: "supply", label: "Do you have stable suppliers and procurement cycles?", helper: "Supply continuity lowers execution risk." },
    { id: "staff", label: "Do you have key staff with clear responsibilities?", helper: "Role clarity supports continuity." },
  ]},
  { id: "market", title: "Market & Traction", questions: [
    { id: "customers", label: "Do you have recurring customers or contracts?", helper: "Recurring demand supports predictability." },
    { id: "growth", label: "Has revenue remained stable or grown recently?", helper: "Stable trends improve readiness." },
    { id: "competition", label: "Can you explain your market differentiation?", helper: "Clear value proposition builds confidence." },
  ]},
  { id: "governance", title: "Governance & Team", questions: [
    { id: "structure", label: "Is there a documented decision-making structure?", helper: "Governance improves accountability." },
    { id: "reporting", label: "Can you produce periodic funder updates?", helper: "Reporting readiness is often mandatory." },
    { id: "risk", label: "Do you track risks and mitigation plans?", helper: "Risk controls improve approval odds." },
  ]},
  { id: "funding", title: "Funding Strategy", questions: [
    { id: "purpose", label: "Is the funding use-case specific and costed?", helper: "Clear use-of-funds is required across pathways." },
    { id: "amount", label: "Is requested amount estimated with assumptions?", helper: "Accurate sizing reduces financing mismatch." },
    { id: "repayment", label: "For debt, do you have a repayment plan?", helper: "Repayment logic is essential for loans." },
  ]},
];

const pathwayMeta = {
  loan: { title: "Loan", icon: Landmark, desc: "Assesses repayment capacity and debt fitness." },
  grant: { title: "Grant", icon: Wallet, desc: "Assesses impact fit and reporting readiness." },
  investment: { title: "Investment", icon: TrendingUp, desc: "Assesses growth potential and governance confidence." },
};

export default function Page() {
  const [pathway, setPathway] = useState<Pathway>("loan");
  const [sectionIndex, setSectionIndex] = useState(0);
  const [answers, setAnswers] = useState<Record<string, Answer>>({});
  const [showReport, setShowReport] = useState(false);
  const [downloading, setDownloading] = useState(false);

  const allQ = useMemo(() => sections.flatMap((s) => s.questions), []);
  const answered = allQ.filter((q) => answers[q.id]).length;
  const score = Math.round((allQ.filter((q) => answers[q.id] === "yes").length / allQ.length) * 100);
  const completion = Math.round((answered / allQ.length) * 100);
  const active = sections[sectionIndex];

  if (showReport) {
    return (
      <section className="space-y-5 pb-6">
        <div className="rounded-3xl border bg-white p-4 sm:p-6">
          <div className="flex flex-wrap justify-between gap-3">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.2em] text-emerald-700">Readiness Report Preview</p>
              <h1 className="mt-1 text-2xl font-bold text-slate-900">Access to Finance Readiness Index (AFRI)</h1>
            </div>
            <button onClick={async () => {
              setDownloading(true);
              try {
                await downloadFinanceReadinessPdf({ score, pathway });
              } finally {
                setDownloading(false);
              }
            }} className="inline-flex items-center gap-2 rounded-xl bg-emerald-700 px-4 py-2.5 text-sm font-semibold text-white hover:bg-emerald-800">
              <Download className="h-4 w-4" />{downloading ? "Preparing PDF..." : "Download PDF Report"}
            </button>
          </div>
          <div className="mt-4 grid gap-4 md:grid-cols-3">
            <div className="rounded-2xl border bg-emerald-50 p-4"><p className="text-sm">AFRI score</p><p className="text-4xl font-bold">{score}/100</p></div>
            <div className="rounded-2xl border bg-slate-50 p-4"><p className="text-sm">Readiness band</p><p className="mt-2 text-sm font-semibold">{score >= 80 ? "High readiness" : score >= 60 ? "Moderate readiness" : "Early-stage readiness"}</p></div>
            <div className="rounded-2xl border bg-slate-50 p-4"><p className="text-sm">Current pathway</p><p className="mt-2 text-sm font-semibold capitalize">{pathway}</p></div>
          </div>
        </div>
        <button onClick={() => setShowReport(false)} className="rounded-xl border px-4 py-2 text-sm">Back to diagnostic</button>
      </section>
    );
  }

  return (
    <section className="space-y-5 pb-24">
      <div className="rounded-3xl border border-emerald-200 bg-gradient-to-br from-emerald-50 to-white p-4 sm:p-6">
        <h1 className="text-2xl font-bold">Access to Finance Readiness Diagnostic</h1>
        <p className="mt-2 text-sm text-slate-600">Business: Adebayo Agro Ventures • DBIN-MSME-448201 • Pathway: <span className="capitalize">{pathway}</span></p>
      </div>
      <div className="grid gap-3 md:grid-cols-3">
        {(Object.keys(pathwayMeta) as Pathway[]).map((k) => {
          const Icon = pathwayMeta[k].icon;
          return (
            <button key={k} onClick={() => setPathway(k)} className={`rounded-2xl border p-4 text-left ${pathway === k ? "border-emerald-500 bg-emerald-50" : "bg-white"}`}>
              <div className="flex items-center gap-2"><Icon className="h-4 w-4 text-emerald-700" /><p className="font-semibold">{pathwayMeta[k].title}</p></div>
              <p className="mt-2 text-sm text-slate-600">{pathwayMeta[k].desc}</p>
            </button>
          );
        })}
      </div>
      <div className="rounded-2xl border bg-white p-4">
        <p className="text-sm font-semibold">Section {sectionIndex + 1} of 6: {active.title}</p>
        <p className="text-sm text-slate-600">{answered} of {allQ.length} answered</p>
        <div className="mt-2 h-2 rounded-full bg-slate-100"><div className="h-2 rounded-full bg-emerald-600" style={{ width: `${completion}%` }} /></div>
      </div>
      <div className="space-y-3">
        {active.questions.map((q) => (
          <div key={q.id} className="rounded-2xl border bg-white p-4">
            <p className="font-medium">{q.label}</p>
            <p className="mt-1 text-sm text-slate-600">{q.helper}</p>
            <div className="mt-3 grid grid-cols-2 gap-2 sm:w-[280px]">
              <button onClick={() => setAnswers((p) => ({ ...p, [q.id]: "yes" }))} className={`rounded-lg border px-4 py-2 ${answers[q.id] === "yes" ? "border-emerald-600 bg-emerald-100" : ""}`}>Yes</button>
              <button onClick={() => setAnswers((p) => ({ ...p, [q.id]: "no" }))} className={`rounded-lg border px-4 py-2 ${answers[q.id] === "no" ? "border-rose-500 bg-rose-50" : ""}`}>No</button>
            </div>
          </div>
        ))}
      </div>
      <div className="fixed bottom-0 left-0 right-0 z-10 border-t bg-white/95 p-3">
        <div className="mx-auto flex w-full max-w-6xl flex-col gap-2 sm:flex-row sm:justify-between">
          <button onClick={() => setSectionIndex((n) => Math.max(0, n - 1))} disabled={sectionIndex === 0} className="inline-flex items-center justify-center gap-1 rounded-lg border px-4 py-2 text-sm disabled:opacity-50"><ArrowLeft className="h-4 w-4" />Back</button>
          {sectionIndex < sections.length - 1 ? (
            <button onClick={() => setSectionIndex((n) => Math.min(sections.length - 1, n + 1))} className="inline-flex items-center justify-center gap-1 rounded-lg bg-emerald-700 px-4 py-2 text-sm font-semibold text-white">Next Section <ArrowRight className="h-4 w-4" /></button>
          ) : (
            <button onClick={() => setShowReport(true)} className="inline-flex items-center justify-center gap-1 rounded-lg bg-emerald-700 px-4 py-2 text-sm font-semibold text-white"><CheckCircle2 className="h-4 w-4" />View Report</button>
          )}
        </div>
      </div>
    </section>
  );
}


const A4_PORTRAIT_WIDTH_PT = 595.28;
const A4_PORTRAIT_HEIGHT_PT = 841.89;

function bytes(value: string) { return new TextEncoder().encode(value); }

function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.rel = "noopener";
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 2000);
}

async function downloadFinanceReadinessPdf({ score, pathway }: { score: number; pathway: Pathway }) {
  const canvas = document.createElement("canvas");
  canvas.width = 1240; canvas.height = 1754;
  const ctx = canvas.getContext("2d");
  if (!ctx) return;
  ctx.fillStyle = "#f3f6f4"; ctx.fillRect(0,0,canvas.width,canvas.height);
  ctx.fillStyle = "#ffffff"; roundRect(ctx,30,20,1180,1714,20,true);
  const now = new Date();
  const dateText = now.toLocaleDateString("en-GB", { day: "2-digit", month: "long", year: "numeric" });
  const timeText = now.toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit" });
  ctx.fillStyle="#0b5d38"; ctx.font="700 56px Arial"; ctx.fillText("DBIN",70,90);
  ctx.fillStyle="#113524"; ctx.font="700 50px Arial"; ctx.fillText("ACCESS TO FINANCE READINESS REPORT",260,95);
  ctx.fillStyle="#4b5563"; ctx.font="30px Arial"; ctx.fillText("MSME Readiness Diagnostic Summary",260,138);
  ctx.font="600 20px Arial"; ctx.fillText("REPORT DATE",1020,72); ctx.font="20px Arial"; ctx.fillText(`${dateText} ${timeText}`,980,102);
  roundRect(ctx,60,170,1120,120,16,true,"#f7f9f8","#d9dfdb");
  const msmeId="DBIN-MSME-448201"; const business="Adebayo Agro Ventures"; const amount="₦1,000,000";
  metaItem(ctx,90,208,"Business Name",business); metaItem(ctx,380,208,"DBIN / MSME ID",msmeId); metaItem(ctx,650,208,"Assessment Pathway",pathwayMeta[pathway].title+" Readiness"); metaItem(ctx,920,208,"Funding Amount Needed",amount,"#0b7a45");
  roundRect(ctx,60,320,720,360,16,true,"#04653c");
  ctx.fillStyle="#fff"; ctx.font="700 34px Arial"; ctx.fillText("AFRI SCORE",100,380); ctx.font="700 110px Arial"; ctx.fillText(`${score}%`,100,500);
  roundRect(ctx,100,540,580,28,14,true,"#e5e7eb"); roundRect(ctx,100,540,Math.max(40,5.8*score),28,14,true,"#22c55e");
  ctx.font="24px Arial"; ctx.fillText("0%",100,595); ctx.fillText("100%",640,595);
  ctx.fillStyle="#fff"; ctx.font="700 34px Arial"; ctx.fillText("READINESS BAND",430,380);
  const band=score>=80?"ADVANCED":score>=60?"STABLE":score>=40?"EMERGING":"EARLY-STAGE";
  roundRect(ctx,430,410,230,52,26,true,"#f2c94c"); ctx.fillStyle="#202020"; ctx.font="700 28px Arial"; ctx.fillText(band,455,446);
  ctx.fillStyle="#fff"; ctx.font="30px Arial"; wrapText(ctx,`Your business shows ${score>=60?"moderate":"foundational"} readiness. Address the gaps to improve access to finance opportunities.`,430,500,300,44);
  roundRect(ctx,810,320,370,360,16,true,"#ffffff","#d9dfdb");
  metaLine(ctx,840,390,"Assessment Completed","28 April 2025"); metaLine(ctx,840,490,"Report Generated",dateText); metaLine(ctx,840,590,"Next Review Recommended","In 90 days");
  roundRect(ctx,60,710,1120,240,16,true,"#fff","#d9dfdb"); ctx.fillStyle="#14532d"; ctx.font="700 30px Arial"; ctx.fillText("CATEGORY BREAKDOWN",90,760);
  const cats=[["Business Identity Readiness",70,"#15803d"],["Financial Records & Discipline",68,"#15803d"],["Tax, Compliance & Regulatory",40,"#f59e0b"],["Operations & Business Stability",40,"#f59e0b"],["Growth Intent & Funding Need",52,"#166534"],["Risk Signals & Readiness Gaps",40,"#dc2626"]] as const;
  cats.forEach((c,i)=>{const x=90+i*180; ctx.fillStyle="#111827"; ctx.font="18px Arial"; wrapText(ctx,c[0],x,805,160,24); roundRect(ctx,x,880,150,14,7,true,"#e5e7eb"); roundRect(ctx,x,880,1.5*c[1],14,7,true,c[2]); ctx.fillStyle="#14532d"; ctx.font="700 34px Arial"; ctx.fillText(`${c[1]}%`,x+40,930);});
  const qr = await QRCode.toDataURL(`https://ndmii.gov.ng/verify/${msmeId}`); const qrImg = new Image(); await new Promise(r=>{qrImg.onload=r; qrImg.src=qr;});
  roundRect(ctx,60,980,370,210,16,true,"#f4faf6","#d9dfdb"); sectionList(ctx,90,1030,"STRENGTHS",["Verified business identity","Consistent transaction tracking","Good bookkeeping discipline","Clear growth intent"]);
  roundRect(ctx,440,980,370,210,16,true,"#fffaf0","#e8dec5"); sectionList(ctx,470,1030,"READINESS GAPS",["Tax filings not up to date","Limited operational documentation","Weak governance structure"] ,"#92400e");
  roundRect(ctx,820,980,360,210,16,true,"#fff5f5","#f2d0d0"); sectionList(ctx,850,1030,"RISK FLAGS",["High debt pressure may affect repayment readiness"] ,"#b91c1c");
  roundRect(ctx,60,1220,1120,230,16,true,"#fff","#d9dfdb"); ctx.fillStyle="#14532d"; ctx.font="700 30px Arial"; ctx.fillText("RECOMMENDED NEXT ACTIONS",90,1270);
  threeCol(ctx,90,1310,"PRIORITY ACTIONS (Next 30 Days)",["File outstanding tax returns","Strengthen record keeping","Resolve compliance issues"]);
  threeCol(ctx,470,1310,"MEDIUM-TERM ACTIONS (Next 90 Days)",["Improve cashflow documentation","Build business credit profile","Maintain consistent records"]);
  threeCol(ctx,850,1310,"INVESTOR-GRADE IMPROVEMENTS (Next 6 Months)",["Develop detailed business plan","Strengthen governance structure","Build investor-ready pitch deck"]);
  roundRect(ctx,60,1470,360,210,16,true,"#f4faf6","#d9dfdb"); wrapText(ctx,`FUNDING SIGNAL SUMMARY
Recommended Funding Type: Investment
Readiness Confidence: Moderate`,90,1520,300,30);
  roundRect(ctx,440,1470,360,210,16,true,"#fff","#d9dfdb"); wrapText(ctx,`ABOUT THIS REPORT
This report summarizes readiness based on the DBIN platform. It identifies gaps and improvement actions.`,470,1520,300,30);
  roundRect(ctx,820,1470,360,210,16,true,"#fff","#d9dfdb"); ctx.fillStyle="#14532d"; ctx.font="700 24px Arial"; ctx.fillText("VERIFY THIS REPORT",850,1520); ctx.drawImage(qrImg,850,1540,120,120);
  const jpegBlob: Blob = await new Promise((resolve,reject)=> canvas.toBlob(b=>b?resolve(b):reject(new Error("jpeg failed")),"image/jpeg",0.92));
  await buildPdfFromJpeg(jpegBlob, canvas.width, canvas.height, `finance-readiness-report-${msmeId}.pdf`);
}
function roundRect(ctx:any,x:number,y:number,w:number,h:number,r:number,fill:boolean,fillColor?:string,strokeColor?:string){ctx.beginPath();ctx.moveTo(x+r,y);ctx.arcTo(x+w,y,x+w,y+h,r);ctx.arcTo(x+w,y+h,x,y+h,r);ctx.arcTo(x,y+h,x,y,r);ctx.arcTo(x,y,x+w,y,r);ctx.closePath();if(fill){ctx.fillStyle=fillColor||"#fff";ctx.fill();} if(strokeColor){ctx.strokeStyle=strokeColor;ctx.stroke();}}
function wrapText(ctx:any,text:string,x:number,y:number,max:number,lh:number){text.split("\n").forEach((p,idx)=>{let line="";p.split(" ").forEach(w=>{const t=(line?line+" ":"")+w;if(ctx.measureText(t).width>max){ctx.fillText(line,x,y);line=w;y+=lh;}else line=t;});ctx.fillText(line,x,y);y+=lh; if(idx<text.split("\n").length-1) y+=4;});}
function metaItem(ctx:any,x:number,y:number,l:string,v:string,c="#111827"){ctx.fillStyle="#6b7280";ctx.font="18px Arial";ctx.fillText(l,x,y);ctx.fillStyle=c;ctx.font="700 28px Arial";ctx.fillText(v,x,y+36);}
function metaLine(ctx:any,x:number,y:number,l:string,v:string){ctx.fillStyle="#6b7280";ctx.font="21px Arial";ctx.fillText(l,x,y);ctx.fillStyle="#111827";ctx.font="700 30px Arial";ctx.fillText(v,x,y+40);}
function sectionList(ctx:any,x:number,y:number,title:string,items:string[],color="#166534"){ctx.fillStyle=color;ctx.font="700 28px Arial";ctx.fillText(title,x,y);ctx.fillStyle="#1f2937";ctx.font="22px Arial";items.forEach((it,i)=>ctx.fillText(`• ${it}`,x,y+42+i*34));}
function threeCol(ctx:any,x:number,y:number,t:string,items:string[]){ctx.fillStyle="#166534";ctx.font="700 22px Arial";wrapText(ctx,t,x,y,300,26);ctx.fillStyle="#1f2937";ctx.font="20px Arial";items.forEach((it,i)=>ctx.fillText(`✓ ${it}`,x,y+52+i*30));}

async function buildPdfFromJpeg(jpegBlob: Blob, imageWidth: number, imageHeight: number, fileName: string) {
  const imageBytes = new Uint8Array(await jpegBlob.arrayBuffer());
  const margin = 20; const usableW = A4_PORTRAIT_WIDTH_PT - margin * 2; const usableH = A4_PORTRAIT_HEIGHT_PT - margin * 2;
  const scale = Math.min(usableW / imageWidth, usableH / imageHeight); const drawW = imageWidth * scale; const drawH = imageHeight * scale; const drawX = (A4_PORTRAIT_WIDTH_PT - drawW)/2; const drawY=(A4_PORTRAIT_HEIGHT_PT-drawH)/2;
  const stream = `q
${drawW.toFixed(2)} 0 0 ${drawH.toFixed(2)} ${drawX.toFixed(2)} ${drawY.toFixed(2)} cm
/Im0 Do
Q
`;
  const objects=[{id:1,head:"<< /Type /Catalog /Pages 2 0 R >>"},{id:2,head:"<< /Type /Pages /Kids [3 0 R] /Count 1 >>"},{id:3,head:`<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${A4_PORTRAIT_WIDTH_PT.toFixed(2)} ${A4_PORTRAIT_HEIGHT_PT.toFixed(2)}] /Resources << /XObject << /Im0 4 0 R >> /ProcSet [/PDF /ImageC] >> /Contents 5 0 R >>`},{id:4,head:`<< /Type /XObject /Subtype /Image /Width ${imageWidth} /Height ${imageHeight} /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode /Length ${imageBytes.length} >>`,streamBytes:imageBytes},{id:5,head:`<< /Length ${bytes(stream).length} >>`,streamBytes:bytes(stream)}] as any[];
  const header=bytes("%PDF-1.4\n"); const parts:any=[header]; const xref=[0]; let offset=header.length;
  for (const o of objects){xref.push(offset); const h=bytes(`${o.id} 0 obj\n${o.head}\n`); parts.push(h); offset+=h.length; if(o.streamBytes){const s=bytes("stream\n"); const e=bytes("\nendstream\n"); parts.push(s,o.streamBytes,e); offset+=s.length+o.streamBytes.length+e.length;} const end=bytes("endobj\n"); parts.push(end); offset+=end.length;}
  let x=`xref\n0 ${xref.length}\n0000000000 65535 f \n`; for(let i=1;i<xref.length;i++) x+=`${String(xref[i]).padStart(10,"0")} 00000 n \n`;
  parts.push(bytes(x),bytes(`trailer\n<< /Size ${xref.length} /Root 1 0 R >>\nstartxref\n${offset}\n%%EOF`));
  downloadBlob(new Blob(parts,{type:"application/pdf"}), fileName);
}
