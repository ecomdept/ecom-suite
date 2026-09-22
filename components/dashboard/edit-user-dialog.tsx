"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import { Loader2, Pencil, Save, X } from "lucide-react";
import {
  updateUserAction,
  type UpdateUserActionState,
} from "@/app/dashboard/actions";
import { FormMessage } from "@/components/auth/form-message";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { APP_ROLES, ROLE_LABELS, type AppRole } from "@/lib/auth/roles";

const initialState: UpdateUserActionState = {};

type EditUserDialogProps = {
  userId: string;
  fullName: string;
  email: string;
  roles: AppRole[];
  isCurrentUser: boolean;
};

export function EditUserDialog({
  userId,
  fullName,
  email,
  roles,
  isCurrentUser,
}: EditUserDialogProps) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const [state, action, pending] = useActionState(
    updateUserAction,
    initialState,
  );
  const [selectedRoles, setSelectedRoles] = useState(roles);

  useEffect(() => {
    if (state.success) dialogRef.current?.close();
  }, [state.success]);

  function toggleRole(role: AppRole, checked: boolean) {
    setSelectedRoles((current) =>
      checked
        ? [...new Set([...current, role])]
        : current.filter((item) => item !== role),
    );
  }

  const clientSelected = selectedRoles.includes("client");

  return (
    <>
      <Button
        aria-label={`Edit ${fullName}`}
        onClick={() => dialogRef.current?.showModal()}
        size="sm"
        type="button"
        variant="outline"
      >
        <Pencil />
        Edit
      </Button>
      <dialog
        aria-labelledby={`edit-user-${userId}`}
        className="m-auto w-[calc(100%_-_2rem)] max-w-xl rounded-2xl border border-stone-200 bg-white p-0 text-left text-slate-950 shadow-2xl backdrop:bg-slate-950/55"
        ref={dialogRef}
      >
        <div className="flex items-start justify-between gap-4 border-b border-stone-100 px-5 py-4 sm:px-6">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wider text-pink-600">
              User administration
            </p>
            <h2
              className="mt-1 text-xl font-semibold"
              id={`edit-user-${userId}`}
            >
              Edit account
            </h2>
          </div>
          <Button
            aria-label="Close"
            onClick={() => dialogRef.current?.close()}
            size="icon"
            type="button"
            variant="ghost"
          >
            <X />
          </Button>
        </div>
        <form action={action} className="grid gap-5 p-5 sm:p-6">
          <input name="userId" type="hidden" value={userId} />
          {isCurrentUser && selectedRoles.includes("admin") ? (
            <input name="roles" type="hidden" value="admin" />
          ) : null}
          <div className="space-y-2">
            <Label htmlFor={`name-${userId}`}>Full name</Label>
            <Input
              defaultValue={fullName}
              id={`name-${userId}`}
              maxLength={100}
              minLength={2}
              name="fullName"
              required
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor={`email-${userId}`}>Email</Label>
            <Input
              defaultValue={email}
              id={`email-${userId}`}
              name="email"
              required
              type="email"
            />
          </div>
          <fieldset className="space-y-3">
            <legend className="text-sm font-medium">Roles</legend>
            <p className="text-xs text-slate-500">
              Select multiple agency responsibilities. Client access must remain
              separate.
            </p>
            <div className="grid gap-2 sm:grid-cols-2">
              {APP_ROLES.map((role) => {
                const checked = selectedRoles.includes(role);
                const disabled =
                  (clientSelected && role !== "client") ||
                  (!clientSelected &&
                    role === "client" &&
                    selectedRoles.length > 0) ||
                  (isCurrentUser && role === "admin");

                return (
                  <label
                    className={`flex items-center gap-3 rounded-lg border px-3 py-3 text-sm ${disabled ? "cursor-not-allowed bg-stone-50 text-slate-400" : "cursor-pointer bg-white hover:border-pink-200"}`}
                    key={role}
                  >
                    <input
                      checked={checked}
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
          </fieldset>
          <FormMessage error={state.error} success={state.success} />
          <Button
            className="justify-self-start bg-pink-600 hover:bg-pink-500"
            disabled={pending}
            type="submit"
          >
            {pending ? <Loader2 className="animate-spin" /> : <Save />}
            {pending ? "Saving…" : "Save account"}
          </Button>
        </form>
      </dialog>
    </>
  );
}
