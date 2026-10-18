import { PDFDocument, StandardFonts, rgb } from "pdf-lib";
type Item={label:string;required:boolean;status:string;request_message?:string|null;gap_note?:string|null};
export async function financePreparationPack(input:{institutionName:string;businessName:string;businessId:string;status:string;
  gapSummary:string;readinessNote:string;items:Item[];applicationReference?:string|null;applicationStatus?:string|null}){
 const pdf=await PDFDocument.create();const font=await pdf.embedFont(StandardFonts.Helvetica);const bold=await pdf.embedFont(StandardFonts.HelveticaBold);
 let page=pdf.addPage([595,842]);let y=792;const left=48;const width=499;
 const line=(text:string,size=10,isBold=false,color=rgb(.12,.17,.23))=>{if(y<64){page=pdf.addPage([595,842]);y=792;}page.drawText(text,{x:left,y,size,font:isBold?bold:font,color,maxWidth:width});y-=size+7;};
 const wrap=(text:string,size=10,isBold=false)=>{const words=text.replace(/\s+/g," ").trim().split(" ");let current="";for(const word of words){const next=current?`${current} ${word}`:word;if((isBold?bold:font).widthOfTextAtSize(next,size)>width){line(current,size,isBold);current=word}else current=next;}if(current)line(current,size,isBold);};
 line("DBIN FINANCE PREPARATION PACK",16,true,rgb(0,.35,.32));line(input.institutionName,12,true);y-=6;
 line(`Business: ${input.businessName}`,11,true);line(`DBIN ID: ${input.businessId}`);line(`Preparation status: ${input.status.replaceAll("_"," ")}`);
 if(input.applicationReference)line(`Institution application reference: ${input.applicationReference}`);if(input.applicationStatus)line(`Institution workflow status: ${input.applicationStatus}`);
 y-=10;wrap("IMPORTANT: This pack records preparation work and documents supplied. It is not a credit score, offer, approval or commitment to finance. Only a separately recorded institution outcome represents the institution's financing decision.",10,true);y-=10;
 line("READINESS SUMMARY",12,true);wrap(input.readinessNote||"No readiness note recorded.");y-=6;line("IDENTIFIED GAPS",12,true);wrap(input.gapSummary||"No gap summary recorded.");y-=10;
 line("CHECKLIST",12,true);for(const item of input.items){wrap(`${item.required?"Required":"Optional"} · ${item.status.toUpperCase()} · ${item.label}`,10,true);if(item.gap_note)wrap(`Gap: ${item.gap_note}`,9);if(item.request_message)wrap(`Request: ${item.request_message}`,9);y-=4;}
 y-=10;line(`Generated ${new Date().toISOString().slice(0,10)} from the DBIN institution workspace.`,8,false,rgb(.35,.4,.46));
 return pdf.save();
}
