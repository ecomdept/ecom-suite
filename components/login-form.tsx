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
      <p className="text-sm font-semibold text-indigo-600">Welcome back</p>
      <h1 className="mt-2 text-3xl font-semibold tracking-tight text-slate-950">Sign in to Orbit</h1>
      <p className="mt-2 text-sm leading-6 text-slate-600">Pick up where your team left off.</p>

      <form action={formAction} className="mt-8 space-y-5">
        <input name="next" type="hidden" value={next} />
        <div className="space-y-2">
          <Label htmlFor="email">Email address</Label>
          <Input autoComplete="email" autoFocus className="h-11 bg-white" id="email" maxLength={254} name="email" placeholder="you@company.com" required type="email" />
        </div>
        <div className="space-y-2">
          <div className="flex items-center justify-between gap-4">
            <Label htmlFor="password">Password</Label>
            <Link className="text-sm font-medium text-indigo-600 hover:text-indigo-500" href="/auth/forgot-password">Forgot password?</Link>
          </div>
          <Input autoComplete="current-password" className="h-11 bg-white" id="password" name="password" required type="password" />
        </div>
        <FormMessage error={state.error} />
        <Button className="h-11 w-full bg-indigo-600 hover:bg-indigo-500" disabled={pending} type="submit">
          {pending ? <Loader2 aria-hidden="true" className="animate-spin" /> : <ArrowRight aria-hidden="true" />}
          {pending ? "Signing in…" : "Sign in"}
        </Button>
      </form>

      <p className="mt-7 text-center text-sm text-slate-600">
        New to Orbit?{" "}<Link className="font-semibold text-indigo-600 hover:text-indigo-500" href="/auth/sign-up">Create an account</Link>
      </p>
    </div>
  );
}
