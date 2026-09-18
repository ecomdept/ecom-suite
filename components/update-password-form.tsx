"use client";

import { useActionState, useState } from "react";
import Link from "next/link";
import { KeyRound, Loader2 } from "lucide-react";
import { updatePasswordAction, type AuthActionState } from "@/app/auth/actions";
import { FormMessage } from "@/components/auth/form-message";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { PASSWORD_MIN_LENGTH } from "@/lib/auth/validation";

const initialState: AuthActionState = {};

export function UpdatePasswordForm() {
  const [state, formAction, pending] = useActionState(updatePasswordAction, initialState);
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
      <span className="grid size-12 place-items-center rounded-xl bg-indigo-50 text-indigo-600"><KeyRound aria-hidden="true" /></span>
      <h1 className="mt-5 text-3xl font-semibold tracking-tight text-slate-950">Choose a new password</h1>
      <p className="mt-2 text-sm leading-6 text-slate-600">Make it memorable and at least {PASSWORD_MIN_LENGTH} characters long.</p>
      {state.success ? (
        <div className="mt-8 space-y-5">
          <FormMessage success={state.success} />
          <Button asChild className="h-11 w-full bg-indigo-600 hover:bg-indigo-500"><Link href="/dashboard">Continue to dashboard</Link></Button>
        </div>
      ) : (
        <form action={formAction} className="mt-8 space-y-5" onSubmit={validateBeforeSubmit}>
          <div className="space-y-2"><Label htmlFor="password">New password</Label><Input autoComplete="new-password" autoFocus className="h-11 bg-white" id="password" maxLength={72} minLength={PASSWORD_MIN_LENGTH} name="password" required type="password" /></div>
          <div className="space-y-2"><Label htmlFor="confirmPassword">Confirm new password</Label><Input autoComplete="new-password" className="h-11 bg-white" id="confirmPassword" maxLength={72} minLength={PASSWORD_MIN_LENGTH} name="confirmPassword" required type="password" /></div>
          <FormMessage error={clientError ?? state.error} />
          <Button className="h-11 w-full bg-indigo-600 hover:bg-indigo-500" disabled={pending} type="submit">
            {pending && <Loader2 aria-hidden="true" className="animate-spin" />}{pending ? "Updating password…" : "Update password"}
          </Button>
        </form>
      )}
    </div>
  );
}
