"use client";

import { useActionState, useState } from "react";
import Link from "next/link";
import { ArrowRight, Loader2 } from "lucide-react";
import { signUpAction, type AuthActionState } from "@/app/auth/actions";
import { FormMessage } from "@/components/auth/form-message";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { PASSWORD_MIN_LENGTH } from "@/lib/auth/validation";

const initialState: AuthActionState = {};

export function SignUpForm() {
  const [state, formAction, pending] = useActionState(signUpAction, initialState);
  const [clientError, setClientError] = useState<string>();

  function validateBeforeSubmit(event: React.FormEvent<HTMLFormElement>) {
    const formData = new FormData(event.currentTarget);
    if (formData.get("password") !== formData.get("confirmPassword")) {
      event.preventDefault();
      setClientError("Passwords do not match.");
      return;
    }
    setClientError(undefined);
  }

  return (
    <div>
      <p className="text-sm font-semibold text-indigo-600">Get started</p>
      <h1 className="mt-2 text-3xl font-semibold tracking-tight text-slate-950">Create your account</h1>
      <p className="mt-2 text-sm leading-6 text-slate-600">Set up your workspace identity in under a minute.</p>

      <form action={formAction} className="mt-7 space-y-4" onSubmit={validateBeforeSubmit}>
        <div className="space-y-2">
          <Label htmlFor="fullName">Full name</Label>
          <Input autoComplete="name" autoFocus className="h-11 bg-white" id="fullName" maxLength={100} minLength={2} name="fullName" placeholder="Alex Morgan" required />
        </div>
        <div className="space-y-2">
          <Label htmlFor="email">Email address</Label>
          <Input autoComplete="email" className="h-11 bg-white" id="email" maxLength={254} name="email" placeholder="you@company.com" required type="email" />
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="password">Password</Label>
            <Input aria-describedby="password-help" autoComplete="new-password" className="h-11 bg-white" id="password" maxLength={72} minLength={PASSWORD_MIN_LENGTH} name="password" required type="password" />
          </div>
          <div className="space-y-2">
            <Label htmlFor="confirmPassword">Confirm password</Label>
            <Input autoComplete="new-password" className="h-11 bg-white" id="confirmPassword" maxLength={72} minLength={PASSWORD_MIN_LENGTH} name="confirmPassword" required type="password" />
          </div>
        </div>
        <p className="text-xs text-slate-500" id="password-help">Use at least {PASSWORD_MIN_LENGTH} characters.</p>
        <FormMessage error={clientError ?? state.error} />
        <Button className="h-11 w-full bg-indigo-600 hover:bg-indigo-500" disabled={pending} type="submit">
          {pending ? <Loader2 aria-hidden="true" className="animate-spin" /> : <ArrowRight aria-hidden="true" />}
          {pending ? "Creating account…" : "Create account"}
        </Button>
      </form>

      <p className="mt-6 text-center text-sm text-slate-600">
        Already have an account?{" "}<Link className="font-semibold text-indigo-600 hover:text-indigo-500" href="/auth/login">Sign in</Link>
      </p>
    </div>
  );
}
