import { FormWrapper } from "@/components/dashboard/form-wrapper";
import { Button } from "@/components/ui/button";

export default function LoginPage() {
  return (
    <main className="mx-auto max-w-md px-6 py-16">
      <FormWrapper title="Sign in to NDMII">
        <input className="w-full rounded border px-3 py-2" placeholder="Email" />
        <input className="w-full rounded border px-3 py-2" placeholder="Password" type="password" />
        <Button className="w-full">Sign in</Button>
      </FormWrapper>
    </main>
  );
}
