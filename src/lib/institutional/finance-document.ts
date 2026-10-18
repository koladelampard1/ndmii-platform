import { AdministrationError } from "@/lib/institutional/administration-server";
export const FINANCE_BUCKET = "institution-finance-documents";
export async function checkedFinanceFile(form: FormData) {
  const file = form.get("file");
  if (!(file instanceof File) || file.size < 1 || file.size > 10485760 ||
    !["application/pdf","image/png","image/jpeg"].includes(file.type))
    throw new AdministrationError(400, "Upload a PDF, PNG or JPEG under 10 MB.");
  const bytes = new Uint8Array(await file.arrayBuffer());
  const signature = file.type === "application/pdf" ? [37,80,68,70,45] : file.type === "image/png" ? [137,80,78,71,13,10,26,10] : [255,216,255];
  if (!signature.every((byte,index) => bytes[index] === byte)) throw new AdministrationError(400, "File content does not match its type.");
  return { file, bytes };
}
