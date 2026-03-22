import { FormWrapper } from "@/components/dashboard/form-wrapper";
import { Button } from "@/components/ui/button";

export default function RegisterPage() {
  return (
    <main className="mx-auto max-w-xl px-6 py-16">
      <FormWrapper title="MSME Onboarding Wizard (MVP)">
        <input className="w-full rounded border px-3 py-2" placeholder="Business Name" />
        <input className="w-full rounded border px-3 py-2" placeholder="CAC Number" />
        <input className="w-full rounded border px-3 py-2" placeholder="TIN" />
        <select className="w-full rounded border px-3 py-2">
          <option>Lagos</option>
          <option>Kano</option>
          <option>Rivers</option>
          <option>FCT</option>
        </select>
        <Button className="w-full">Generate MSME ID</Button>
      </FormWrapper>
    </main>
  );
}
