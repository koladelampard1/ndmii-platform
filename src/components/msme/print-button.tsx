"use client";

type PrintButtonProps = {
  targetId?: string;
};

export function PrintButton({ targetId = "msme-id-card-canvas" }: PrintButtonProps) {
  const handlePrintCard = () => {
    const card = document.getElementById(targetId);
    if (!card) return;

    const printWindow = window.open("", "_blank", "noopener,noreferrer,width=1100,height=800");
    if (!printWindow) return;

    const headMarkup = Array.from(document.querySelectorAll("style, link[rel='stylesheet']"))
      .map((node) => node.outerHTML)
      .join("\n");

    const clonedCard = card.cloneNode(true) as HTMLElement;

    printWindow.document.open();
    printWindow.document.write(`
      <html>
        <head>
          <title>NDMII MSME Digital ID Card</title>
          ${headMarkup}
          <style>
            body {
              margin: 0;
              min-height: 100vh;
              display: grid;
              place-items: center;
              background: #f8fafc;
              padding: 24px;
            }
            #print-root {
              width: min(100%, 1080px);
            }
          </style>
        </head>
        <body>
          <main id="print-root"></main>
        </body>
      </html>
    `);
    printWindow.document.close();

    const container = printWindow.document.getElementById("print-root");
    if (!container) {
      printWindow.close();
      return;
    }

    container.appendChild(clonedCard);

    printWindow.focus();
    printWindow.onload = () => {
      printWindow.print();
      printWindow.close();
    };
  };

  return (
    <button
      onClick={handlePrintCard}
      className="rounded-xl bg-slate-900 px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-slate-800"
    >
      Download / Print
    </button>
  );
}
