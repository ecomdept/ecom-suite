"use client";

import { useActionState } from "react";
import { Loader2, Save, Settings2, Users } from "lucide-react";
import {
  updateProjectMembersAction,
  updateProjectSettingsAction,
  type ProjectActionState,
} from "@/app/projects/actions";
import { FormMessage } from "@/components/auth/form-message";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { ProjectMemberOption } from "@/components/projects/create-project-form";

const initialState: ProjectActionState = {};

export function ProjectAdminSettings({
  projectId,
  users,
  selectedMemberIds,
  retainerHours,
  budgetAmount,
  currency,
  periodStart,
  periodEnd,
}: {
  projectId: string;
  users: ProjectMemberOption[];
  selectedMemberIds: string[];
  retainerHours: number | null;
  budgetAmount: number | null;
  currency: string;
  periodStart: string | null;
  periodEnd: string | null;
}) {
  const [memberState, memberAction, membersPending] = useActionState(updateProjectMembersAction, initialState);
  const [settingsState, settingsAction, settingsPending] = useActionState(updateProjectSettingsAction, initialState);
  const selected = new Set(selectedMemberIds);

  return (
    <details className="mt-8 overflow-hidden rounded-2xl border border-stone-200 bg-white shadow-sm">
      <summary className="flex cursor-pointer list-none items-center gap-2 px-5 py-4 font-medium marker:hidden sm:px-7">
        <Settings2 aria-hidden="true" className="size-4 text-pink-600" />Project administration
      </summary>
      <div className="grid border-t border-stone-100 lg:grid-cols-2 lg:divide-x lg:divide-slate-100">
        <form action={settingsAction} className="grid content-start gap-4 p-5 sm:p-7">
          <input name="projectId" type="hidden" value={projectId} />
          <div><h2 className="font-semibold">Retainer and budget</h2><p className="mt-1 text-xs text-slate-500">Configure the totals shown to project members and clients.</p></div>
          <div className="grid gap-4 sm:grid-cols-3">
            <div className="space-y-2"><Label htmlFor="settings-retainer">Retainer hours</Label><Input defaultValue={retainerHours ?? ""} id="settings-retainer" min="0" name="retainerHours" step="0.25" type="number" /></div>
            <div className="space-y-2"><Label htmlFor="settings-budget">Budget</Label><Input defaultValue={budgetAmount ?? ""} id="settings-budget" min="0" name="budgetAmount" step="0.01" type="number" /></div>
            <div className="space-y-2"><Label htmlFor="settings-currency">Currency</Label><Input defaultValue={currency} id="settings-currency" maxLength={3} minLength={3} name="currency" required /></div>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2"><Label htmlFor="settings-period-start">Period starts</Label><Input defaultValue={periodStart ?? ""} id="settings-period-start" name="periodStart" type="date" /></div>
            <div className="space-y-2"><Label htmlFor="settings-period-end">Period ends</Label><Input defaultValue={periodEnd ?? ""} id="settings-period-end" name="periodEnd" type="date" /></div>
          </div>
          <FormMessage error={settingsState.error} success={settingsState.success} />
          <Button className="justify-self-start" disabled={settingsPending} type="submit" variant="outline">
            {settingsPending ? <Loader2 aria-hidden="true" className="animate-spin" /> : <Save aria-hidden="true" />}{settingsPending ? "Saving…" : "Save financial settings"}
          </Button>
        </form>

        <form action={memberAction} className="grid content-start gap-4 p-5 sm:p-7">
          <input name="projectId" type="hidden" value={projectId} />
          <div><h2 className="flex items-center gap-2 font-semibold"><Users aria-hidden="true" className="size-4 text-pink-600" />Project access</h2><p className="mt-1 text-xs text-slate-500">Only selected users can open this project. Admins retain global access.</p></div>
          <fieldset className="grid max-h-64 gap-2 overflow-y-auto rounded-lg border border-stone-200 p-2">
            <legend className="sr-only">Assigned project members</legend>
            {users.map((user) => (
              <label className="flex cursor-pointer items-start gap-3 rounded-md p-2 hover:bg-slate-50" key={user.id}>
                <input className="mt-1 size-4 rounded border-slate-300 text-pink-600 focus:ring-pink-600" defaultChecked={selected.has(user.id)} name="members" type="checkbox" value={user.id} />
                <span className="min-w-0"><span className="block text-sm font-medium text-slate-900">{user.name}</span><span className="block truncate text-xs text-slate-500">{user.email} · {user.role}</span></span>
              </label>
            ))}
            {!users.length && <p className="p-3 text-sm text-slate-500">No users are available.</p>}
          </fieldset>
          <FormMessage error={memberState.error} success={memberState.success} />
          <Button className="justify-self-start" disabled={membersPending} type="submit" variant="outline">
            {membersPending ? <Loader2 aria-hidden="true" className="animate-spin" /> : <Save aria-hidden="true" />}{membersPending ? "Saving…" : "Update project access"}
          </Button>
        </form>
      </div>
    </details>
  );
}
