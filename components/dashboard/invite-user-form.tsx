"use client";

import { useActionState, useState } from "react";
import { Loader2, Send } from "lucide-react";
import {
  inviteUserAction,
  type InviteActionState,
} from "@/app/dashboard/actions";
import { FormMessage } from "@/components/auth/form-message";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { APP_ROLES, ROLE_LABELS, type AppRole } from "@/lib/auth/roles";

const initialState: InviteActionState = {};

export function InviteUserForm() {
  const [state, formAction, pending] = useActionState(
    inviteUserAction,
    initialState,
  );
  const [selectedRoles, setSelectedRoles] = useState<AppRole[]>(["developer"]);

  function toggleRole(role: AppRole, checked: boolean) {
    setSelectedRoles((current) =>
      checked
        ? [...new Set([...current, role])]
        : current.filter((item) => item !== role),
    );
  }

  const clientSelected = selectedRoles.includes("client");

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
      <fieldset className="space-y-3">
        <legend className="text-sm font-medium">Account roles</legend>
        <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
          {APP_ROLES.map((role) => {
            const disabled =
              (clientSelected && role !== "client") ||
              (!clientSelected &&
                role === "client" &&
                selectedRoles.length > 0);

            return (
              <label
                className={`flex items-center gap-3 rounded-lg border px-3 py-3 text-sm ${disabled ? "cursor-not-allowed bg-stone-50 text-slate-400" : "cursor-pointer bg-white hover:border-pink-200"}`}
                key={role}
              >
                <input
                  checked={selectedRoles.includes(role)}
                  className="size-4 rounded border-stone-300 text-pink-600 focus:ring-pink-600"
                  disabled={disabled}
                  name="roles"
                  onChange={(event) =>
                    toggleRole(role, event.target.checked)
                  }
                  type="checkbox"
                  value={role}
                />
                <span>{ROLE_LABELS[role]}</span>
              </label>
            );
          })}
        </div>
        <p className="text-xs text-slate-500">
          Agency users can have several responsibilities. Client access remains
          separate to preserve client-only navigation and permissions.
        </p>
      </fieldset>

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
