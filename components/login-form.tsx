"use client";

import { useActionState } from "react";
import Link from "next/link";
import { ArrowRight, Loader2 } from "lucide-react";
import { signInAction, type AuthActionState } from "@/app/auth/actions";
import { FormMessage } from "@/components/auth/form-message";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

const initialState: AuthActionState = {};

export function LoginForm({ next = "/dashboard" }: { next?: string }) {
  const [state, formAction, pending] = useActionState(signInAction, initialState);

  return (
    <div>
      <p className="eyebrow">Private client access</p>
      <h1 className="mt-3 text-4xl leading-tight text-slate-950">Welcome to your workroom.</h1>
      <p className="mt-3 text-sm leading-6 text-slate-600">Review progress, request work, and stay close to delivery.</p>

      <form action={formAction} className="mt-8 space-y-5">
        <input name="next" type="hidden" value={next} />
        <div className="space-y-2">
          <Label htmlFor="email">Email address</Label>
          <Input autoComplete="email" autoFocus className="h-11 bg-white" id="email" maxLength={254} name="email" placeholder="you@company.com" required type="email" />
        </div>
        <div className="space-y-2">
          <div className="flex items-center justify-between gap-4">
            <Label htmlFor="password">Password</Label>
            <Link className="text-sm font-medium text-pink-600 hover:text-pink-500" href="/auth/forgot-password">Forgot password?</Link>
          </div>
          <Input autoComplete="current-password" className="h-11 bg-white" id="password" name="password" required type="password" />
        </div>
        <FormMessage error={state.error} />
        <Button className="h-11 w-full bg-pink-600 hover:bg-pink-500" disabled={pending} type="submit">
          {pending ? <Loader2 aria-hidden="true" className="animate-spin" /> : <ArrowRight aria-hidden="true" />}
          {pending ? "Signing in…" : "Sign in"}
        </Button>
      </form>

      <p className="mt-7 text-center text-sm text-slate-500">
        Accounts are invitation-only. Contact your administrator if you need access.
      </p>
    </div>
  );
}
