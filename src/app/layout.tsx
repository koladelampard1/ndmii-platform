import "./globals.css";
import { ReactNode } from "react";

export const metadata = {
  title: "Digital Business Identity Network (DBIN)",
  description: "Digital MSME identity infrastructure",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body className="min-h-screen bg-slate-100">{children}</body>
    </html>
  );
}
