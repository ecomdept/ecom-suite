import Link from "next/link";
import { CircleAlert } from "lucide-react";
import { Button } from "@/components/ui/button";

export const instant = false;

export default async function AuthErrorPage({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
  const { error } = await searchParams;
  return (
    <div className="text-center">
      <span className="mx-auto grid size-14 place-items-center rounded-2xl bg-red-50 text-red-600"><CircleAlert aria-hidden="true" className="size-7" /></span>
      <h1 className="mt-5 text-3xl font-semibold tracking-tight text-slate-950">That link didn’t work</h1>
      <p className="mx-auto mt-3 max-w-sm text-sm leading-6 text-slate-600">{error ?? "The authentication link is invalid or has expired. Please try again."}</p>
      <Button asChild className="mt-7 h-11 w-full"><Link href="/auth/login">Return to sign in</Link></Button>
    </div>
  );
}
