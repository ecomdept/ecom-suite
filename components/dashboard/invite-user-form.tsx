"use client";

import { useActionState } from "react";
import { Loader2, Send } from "lucide-react";
import {
  inviteUserAction,
  type InviteActionState,
} from "@/app/dashboard/actions";
import { FormMessage } from "@/components/auth/form-message";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { APP_ROLES, ROLE_LABELS } from "@/lib/auth/roles";

const initialState: InviteActionState = {};

export function InviteUserForm() {
  const [state, formAction, pending] = useActionState(
    inviteUserAction,
    initialState,
  );

  return (
    <form action={formAction} className="grid gap-5">
      <div className="grid gap-5 md:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="invite-full-name">Full name</Label>
          <Input
            autoComplete="off"
            className="h-11"
            id="invite-full-name"
            maxLength={100}
            minLength={2}
            name="fullName"
            placeholder="Alex Morgan"
            required
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="invite-email">Email address</Label>
          <Input
            autoComplete="off"
            className="h-11"
            id="invite-email"
            maxLength={254}
            name="email"
            placeholder="alex@company.com"
            required
            type="email"
          />
        </div>
      </div>
      <div className="space-y-2">
        <Label htmlFor="invite-role">Account role</Label>
        <select
          className="flex h-11 w-full rounded-md border border-input bg-transparent px-3 text-sm shadow-sm outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50"
          defaultValue="developer"
          id="invite-role"
          name="role"
          required
        >
          {APP_ROLES.map((role) => (
            <option key={role} value={role}>
              {ROLE_LABELS[role]}
            </option>
          ))}
        </select>
        <p className="text-xs text-slate-500">
          This role controls account access and can only be changed by an admin.
        </p>
      </div>

      <FormMessage error={state.error} success={state.success} />

      <Button
        className="h-11 justify-self-start bg-pink-600 px-5 hover:bg-pink-500"
        disabled={pending}
        type="submit"
      >
        {pending ? (
          <Loader2 aria-hidden="true" className="animate-spin" />
        ) : (
          <Send aria-hidden="true" />
        )}
        {pending ? "Sending invitation…" : "Send invitation"}
      </Button>
    </form>
  );
}
