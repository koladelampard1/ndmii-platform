import QRCode from "qrcode";

export default async function VerifyPage({ params }: { params: Promise<{ msmeId: string }> }) {
  const { msmeId } = await params;
  const verificationUrl = `https://ndmii.gov.ng/verify/${msmeId}`;
  const qrDataUrl = await QRCode.toDataURL(verificationUrl);

  return (
    <main className="mx-auto max-w-xl px-6 py-16">
      <h1 className="text-2xl font-bold">Public MSME Verification</h1>
      <p className="mt-2 text-slate-600">Verify identity for MSME ID: {msmeId}</p>
      <div className="mt-6 rounded-lg border bg-white p-6 text-center">
        <img src={qrDataUrl} alt={`QR for ${msmeId}`} className="mx-auto h-56 w-56" />
        <p className="mt-4 text-sm text-slate-500">{verificationUrl}</p>
      </div>
    </main>
  );
}
