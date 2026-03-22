import Link from "next/link";
import { Button } from "@/components/ui/button";

export function Navbar() {
  return (
    <header className="border-b bg-white">
      <div className="mx-auto flex max-w-7xl items-center justify-between px-6 py-4">
        <Link href="/" className="text-lg font-semibold">NDMII Platform</Link>
        <nav className="flex items-center gap-3">
          <Link href="/verify/demo-msme-id" className="text-sm text-slate-600">Verify ID</Link>
          <Link href="/login"><Button size="sm">Sign in</Button></Link>
        </nav>
      </div>
    </header>
  );
}
