"use client";

import { useActionState, useState } from "react";
import { FolderPlus, ImagePlus, Loader2 } from "lucide-react";
import { createProjectAction, type ProjectActionState } from "@/app/projects/actions";
import { FormMessage } from "@/components/auth/form-message";
import { Button } from "@/components/ui/button";
import { DatePicker } from "@/components/ui/date-picker";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { RichTextEditor } from "@/components/ui/rich-text-editor";

export type ProjectMemberOption = {
  id: string;
  name: string;
  email: string;
  role: string;
};

const initialState: ProjectActionState = {};

export function CreateProjectForm({ users }: { users: ProjectMemberOption[] }) {
  const [state, formAction, pending] = useActionState(createProjectAction, initialState);
  const [projectType, setProjectType] = useState<"retainer" | "new_build">("retainer");
  const [logoName, setLogoName] = useState("");

  return (
    <form action={formAction} className="grid gap-6">
      <fieldset className="grid gap-3 sm:grid-cols-2">
        <legend className="mb-2 text-sm font-medium">Project type</legend>
        <label className={`cursor-pointer rounded-xl border p-4 transition ${projectType === "retainer" ? "border-pink-500 bg-pink-50/60 ring-1 ring-pink-500" : "border-stone-200 hover:border-stone-300"}`}>
          <input checked={projectType === "retainer"} className="sr-only" name="projectType" onChange={() => setProjectType("retainer")} type="radio" value="retainer" />
          <span className="block text-sm font-semibold">Retainer</span><span className="mt-1 block text-xs leading-5 text-slate-500">Recurring capacity that renews every two-week sprint.</span>
        </label>
        <label className={`cursor-pointer rounded-xl border p-4 transition ${projectType === "new_build" ? "border-pink-500 bg-pink-50/60 ring-1 ring-pink-500" : "border-stone-200 hover:border-stone-300"}`}>
          <input checked={projectType === "new_build"} className="sr-only" name="projectType" onChange={() => setProjectType("new_build")} type="radio" value="new_build" />
          <span className="block text-sm font-semibold">New build</span><span className="mt-1 block text-xs leading-5 text-slate-500">A defined delivery engagement organized in two-week sprints.</span>
        </label>
      </fieldset>

      <div className="grid gap-4 sm:grid-cols-[minmax(0,1fr)_180px]">
        <div className="space-y-2"><Label htmlFor="project-name">Project name</Label><Input id="project-name" maxLength={100} minLength={2} name="name" placeholder="Client storefront" required /></div>
        <div className="space-y-2"><Label htmlFor="project-logo">Client logo <span className="font-normal text-slate-400">(optional)</span></Label><label className="flex h-10 cursor-pointer items-center gap-2 rounded-md border border-input bg-white px-3 text-sm text-slate-500 hover:bg-stone-50" htmlFor="project-logo"><ImagePlus aria-hidden="true" className="size-4" /><span className="truncate">{logoName || "Choose image"}</span></label><input accept="image/jpeg,image/png,image/webp" className="sr-only" id="project-logo" name="clientLogo" onChange={(event) => setLogoName(event.target.files?.[0]?.name ?? "")} type="file" /><p className="text-[11px] text-slate-400">PNG, JPG, or WebP · 1 MB max</p></div>
      </div>

      <div className={`grid gap-4 ${projectType === "retainer" ? "sm:grid-cols-3" : "sm:grid-cols-2"}`}>
        {projectType === "retainer" && <div className="space-y-2"><Label htmlFor="project-retainer">Hours per sprint</Label><Input id="project-retainer" min="0" name="retainerHours" placeholder="40" step="0.25" type="number" /><p className="text-[11px] text-slate-400">Renews every 14 days.</p></div>}
        <div className="space-y-2"><Label htmlFor="project-hourly-rate">Hourly rate <span className="font-normal text-slate-400">(USD)</span></Label><Input id="project-hourly-rate" min="0" name="hourlyRate" placeholder="150" step="0.01" type="number" /></div>
        <div className="space-y-2"><Label htmlFor="project-sprint-start">Sprint starting date</Label><DatePicker id="project-sprint-start" name="sprintStartDate" required /><p className="text-[11px] text-slate-400">Sets the two-week sprint cadence.</p></div>
      </div>

      <div className="space-y-2"><Label htmlFor="project-repository">GitHub repository <span className="font-normal text-slate-400">(optional)</span></Label><Input id="project-repository" inputMode="url" name="repositoryUrl" placeholder="https://github.com/company/repository" type="url" /></div>
      <div className="space-y-2"><Label htmlFor="project-description">Description <span className="font-normal text-slate-400">(optional)</span></Label><RichTextEditor id="project-description" maxLength={2000} minHeight="min-h-24" name="description" placeholder="What is this project responsible for?" /></div>

      {users.length > 0 && (
        <fieldset className="space-y-3">
          <legend className="text-sm font-medium">Project members</legend>
          <p className="text-xs text-slate-500">Selected users will be able to see this project and its tickets.</p>
          <div className="grid max-h-52 gap-2 overflow-y-auto rounded-lg border border-stone-200 p-2 sm:grid-cols-2">
            {users.map((user) => (
              <label className="flex cursor-pointer items-start gap-3 rounded-md p-2 hover:bg-slate-50" key={user.id}>
                <input className="mt-1 size-4 rounded border-slate-300 text-pink-600 focus:ring-pink-600" name="members" type="checkbox" value={user.id} />
                <span className="min-w-0"><span className="block text-sm font-medium text-slate-900">{user.name}</span><span className="block truncate text-xs text-slate-500">{user.email} · {user.role}</span></span>
              </label>
            ))}
          </div>
        </fieldset>
      )}

      <FormMessage error={state.error} />
      <Button className="h-11 justify-self-start bg-pink-600 hover:bg-pink-500" disabled={pending} type="submit">
        {pending ? <Loader2 aria-hidden="true" className="animate-spin" /> : <FolderPlus aria-hidden="true" />}{pending ? "Creating project…" : "Create project"}
      </Button>
    </form>
  );
}
