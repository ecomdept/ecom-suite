"use client";

import { useActionState, useState } from "react";
import { Loader2, Save, Settings2, Users } from "lucide-react";
import { updateProjectMembersAction, updateProjectSettingsAction, type ProjectActionState } from "@/app/projects/actions";
import { FormMessage } from "@/components/auth/form-message";
import { Button } from "@/components/ui/button";
import { DatePicker } from "@/components/ui/date-picker";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { ProjectMemberOption } from "@/components/projects/create-project-form";

const initialState: ProjectActionState = {};

export function ProjectAdminSettings({
  projectId,
  users,
  selectedMemberIds,
  projectType: initialProjectType,
  retainerHours,
  hourlyRate,
  sprintStartDate,
  repositoryUrl,
  status,
  risk,
  rolloverEnabled,
  rolloverCapHours,
  canManageAccess,
}: {
  projectId: string;
  users: ProjectMemberOption[];
  selectedMemberIds: string[];
  projectType: "retainer" | "new_build";
  retainerHours: number | null;
  hourlyRate: number | null;
  sprintStartDate: string;
  repositoryUrl: string | null;
  status: "active" | "on_hold" | "completed";
  risk: "on_track" | "at_risk" | "off_track";
  rolloverEnabled: boolean;
  rolloverCapHours: number | null;
  canManageAccess: boolean;
}) {
  const [memberState, memberAction, membersPending] = useActionState(updateProjectMembersAction, initialState);
  const [settingsState, settingsAction, settingsPending] = useActionState(updateProjectSettingsAction, initialState);
  const [projectType, setProjectType] = useState(initialProjectType);
  const selected = new Set(selectedMemberIds);

  return (
    <details className="mt-8 overflow-hidden rounded-2xl border border-stone-200 bg-white shadow-sm">
      <summary className="flex cursor-pointer list-none items-center gap-2 px-5 py-4 font-medium marker:hidden sm:px-7"><Settings2 aria-hidden="true" className="size-4 text-pink-600" />Project administration</summary>
      <div className={`grid border-t border-stone-100 ${canManageAccess ? "lg:grid-cols-2 lg:divide-x lg:divide-slate-100" : ""}`}>
        <form action={settingsAction} className="grid content-start gap-5 p-5 sm:p-7">
          <input name="projectId" type="hidden" value={projectId} />
          <div><h2 className="font-semibold">Delivery settings</h2><p className="mt-1 text-xs text-slate-500">Manage the sprint cadence and health shown across the portal.</p></div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2"><Label htmlFor="settings-project-type">Project type</Label><select className="flex h-10 w-full rounded-md border border-input bg-white px-3 text-sm" id="settings-project-type" name="projectType" onChange={(event) => setProjectType(event.target.value as "retainer" | "new_build")} value={projectType}><option value="retainer">Retainer</option><option value="new_build">New build</option></select></div>
            <div className="space-y-2"><Label htmlFor="settings-sprint-start">Sprint starting date</Label><DatePicker defaultValue={sprintStartDate} id="settings-sprint-start" name="sprintStartDate" required /></div>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            {projectType === "retainer" && <div className="space-y-2"><Label htmlFor="settings-retainer">Hours per calendar month</Label><Input defaultValue={retainerHours ?? ""} id="settings-retainer" min="0" name="retainerHours" step="0.25" type="number" /></div>}
            <div className="space-y-2"><Label htmlFor="settings-hourly-rate">Hourly rate (USD)</Label><Input defaultValue={hourlyRate ?? ""} id="settings-hourly-rate" min="0" name="hourlyRate" step="0.01" type="number" /></div>
          </div>
          {projectType === "retainer" && <div className="rounded-xl border border-stone-200 p-4"><label className="flex items-start gap-3"><input className="mt-0.5 size-4 rounded border-slate-300 text-pink-600 focus:ring-pink-600" defaultChecked={rolloverEnabled} name="rolloverEnabled" type="checkbox" /><span><span className="block text-sm font-medium">Carry unused hours into the next month</span><span className="mt-1 block text-xs text-slate-500">Rollover is reported separately from newly renewed monthly capacity.</span></span></label><div className="mt-4 space-y-2"><Label htmlFor="settings-rollover-cap">Monthly rollover cap <span className="font-normal text-slate-400">(optional)</span></Label><Input defaultValue={rolloverCapHours ?? ""} id="settings-rollover-cap" min="0" name="rolloverCapHours" placeholder="No cap" step="0.25" type="number" /></div></div>}
          <div className="space-y-2"><Label htmlFor="settings-repository">GitHub repository</Label><Input defaultValue={repositoryUrl ?? ""} id="settings-repository" name="repositoryUrl" placeholder="https://github.com/company/repository" type="url" /></div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2"><Label htmlFor="settings-status">Status</Label><select className="flex h-10 w-full rounded-md border border-input bg-white px-3 text-sm" defaultValue={status} id="settings-status" name="status"><option value="active">Active</option><option value="on_hold">On hold</option><option value="completed">Completed</option></select></div>
            <div className="space-y-2"><Label htmlFor="settings-risk">Risk</Label><select className="flex h-10 w-full rounded-md border border-input bg-white px-3 text-sm" defaultValue={risk} id="settings-risk" name="risk"><option value="on_track">On track</option><option value="at_risk">At risk</option><option value="off_track">Off track</option></select></div>
          </div>
          <FormMessage error={settingsState.error} success={settingsState.success} />
          <Button className="justify-self-start" disabled={settingsPending} type="submit" variant="outline">{settingsPending ? <Loader2 aria-hidden="true" className="animate-spin" /> : <Save aria-hidden="true" />}{settingsPending ? "Saving…" : "Save delivery settings"}</Button>
        </form>

        {canManageAccess && <form action={memberAction} className="grid content-start gap-4 p-5 sm:p-7">
          <input name="projectId" type="hidden" value={projectId} />
          <div><h2 className="flex items-center gap-2 font-semibold"><Users aria-hidden="true" className="size-4 text-pink-600" />Project access</h2><p className="mt-1 text-xs text-slate-500">Only selected users can open this project. Admins retain global access.</p></div>
          <fieldset className="grid max-h-64 gap-2 overflow-y-auto rounded-lg border border-stone-200 p-2">
            <legend className="sr-only">Assigned project members</legend>
            {users.map((user) => <label className="flex cursor-pointer items-start gap-3 rounded-md p-2 hover:bg-slate-50" key={user.id}><input className="mt-1 size-4 rounded border-slate-300 text-pink-600 focus:ring-pink-600" defaultChecked={selected.has(user.id)} name="members" type="checkbox" value={user.id} /><span className="min-w-0"><span className="block text-sm font-medium text-slate-900">{user.name}</span><span className="block truncate text-xs text-slate-500">{user.email} · {user.role}</span></span></label>)}
            {!users.length && <p className="p-3 text-sm text-slate-500">No users are available.</p>}
          </fieldset>
          <FormMessage error={memberState.error} success={memberState.success} />
          <Button className="justify-self-start" disabled={membersPending} type="submit" variant="outline">{membersPending ? <Loader2 aria-hidden="true" className="animate-spin" /> : <Save aria-hidden="true" />}{membersPending ? "Saving…" : "Update project access"}</Button>
        </form>}
      </div>
    </details>
  );
}
