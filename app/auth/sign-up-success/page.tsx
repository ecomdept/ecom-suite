import Link from "next/link";
import { MailCheck } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function SignUpSuccessPage() {
  return (
    <div className="text-center">
      <span className="mx-auto grid size-14 place-items-center rounded-2xl bg-emerald-50 text-emerald-600"><MailCheck aria-hidden="true" className="size-7" /></span>
      <h1 className="mt-5 text-3xl font-semibold tracking-tight text-slate-950">Check your inbox</h1>
      <p className="mx-auto mt-3 max-w-sm text-sm leading-6 text-slate-600">We sent a confirmation link to your email address. Open it to activate your account and continue to Orbit.</p>
      <Button asChild className="mt-7 h-11 w-full" variant="outline"><Link href="/auth/login">Return to sign in</Link></Button>
    </div>
  );
}
