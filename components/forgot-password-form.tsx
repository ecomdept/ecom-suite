"use client";

import { useActionState } from "react";
import Link from "next/link";
import { ArrowLeft, Loader2, Mail } from "lucide-react";
import { forgotPasswordAction, type AuthActionState } from "@/app/auth/actions";
import { FormMessage } from "@/components/auth/form-message";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

const initialState: AuthActionState = {};

export function ForgotPasswordForm() {
  const [state, formAction, pending] = useActionState(forgotPasswordAction, initialState);

  return (
    <div>
      <span className="grid size-12 place-items-center rounded-xl bg-indigo-50 text-indigo-600"><Mail aria-hidden="true" /></span>
      <h1 className="mt-5 text-3xl font-semibold tracking-tight text-slate-950">Reset your password</h1>
      <p className="mt-2 text-sm leading-6 text-slate-600">Enter your account email and we’ll send you a secure reset link.</p>
      <form action={formAction} className="mt-8 space-y-5">
        <div className="space-y-2">
          <Label htmlFor="email">Email address</Label>
          <Input autoComplete="email" autoFocus className="h-11 bg-white" id="email" maxLength={254} name="email" placeholder="you@company.com" required type="email" />
        </div>
        <FormMessage error={state.error} success={state.success} />
        <Button className="h-11 w-full bg-indigo-600 hover:bg-indigo-500" disabled={pending} type="submit">
          {pending && <Loader2 aria-hidden="true" className="animate-spin" />}
          {pending ? "Sending reset link…" : state.success ? "Send another link" : "Send reset link"}
        </Button>
      </form>
      <Link className="mt-7 flex items-center justify-center gap-2 text-sm font-medium text-slate-600 hover:text-slate-950" href="/auth/login">
        <ArrowLeft aria-hidden="true" className="size-4" /> Back to sign in
      </Link>
    </div>
  );
}
