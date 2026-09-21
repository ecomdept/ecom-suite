"use client";

import { useActionState } from "react";
import { FolderPlus, Loader2 } from "lucide-react";
import {
  createProjectAction,
  type ProjectActionState,
} from "@/app/projects/actions";
import { FormMessage } from "@/components/auth/form-message";
import { Button } from "@/components/ui/button";
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

  return (
    <form action={formAction} className="grid gap-5">
      <div className="space-y-2">
        <Label htmlFor="project-name">Project name</Label>
        <Input id="project-name" maxLength={100} minLength={2} name="name" placeholder="Website redesign" required />
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <div className="space-y-2">
          <Label htmlFor="project-retainer">Retainer hours</Label>
          <Input id="project-retainer" min="0" name="retainerHours" placeholder="40" step="0.25" type="number" />
        </div>
        <div className="space-y-2">
          <Label htmlFor="project-budget">Budget</Label>
          <Input id="project-budget" min="0" name="budgetAmount" placeholder="5000" step="0.01" type="number" />
        </div>
        <div className="space-y-2">
          <Label htmlFor="project-currency">Currency</Label>
          <Input defaultValue="USD" id="project-currency" maxLength={3} minLength={3} name="currency" required />
        </div>
      </div>
      <div className="space-y-2">
        <Label htmlFor="project-description">Description</Label>
        <RichTextEditor id="project-description" maxLength={2000} minHeight="min-h-24" name="description" placeholder="What is this project responsible for?" />
      </div>

      {users.length > 0 && (
        <fieldset className="space-y-3">
          <legend className="text-sm font-medium">Project members</legend>
          <p className="text-xs text-slate-500">Selected users will be able to see this project and its tickets.</p>
          <div className="grid max-h-52 gap-2 overflow-y-auto rounded-lg border border-stone-200 p-2 sm:grid-cols-2">
            {users.map((user) => (
              <label className="flex cursor-pointer items-start gap-3 rounded-md p-2 hover:bg-slate-50" key={user.id}>
                <input className="mt-1 size-4 rounded border-slate-300 text-pink-600 focus:ring-pink-600" name="members" type="checkbox" value={user.id} />
                <span className="min-w-0">
                  <span className="block text-sm font-medium text-slate-900">{user.name}</span>
                  <span className="block truncate text-xs text-slate-500">{user.email} · {user.role}</span>
                </span>
              </label>
            ))}
          </div>
        </fieldset>
      )}

      <FormMessage error={state.error} />
      <Button className="h-11 justify-self-start bg-pink-600 hover:bg-pink-500" disabled={pending} type="submit">
        {pending ? <Loader2 aria-hidden="true" className="animate-spin" /> : <FolderPlus aria-hidden="true" />}
        {pending ? "Creating project…" : "Create project"}
      </Button>
    </form>
  );
}
