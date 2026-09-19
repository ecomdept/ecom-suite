"use client";

import { useActionState } from "react";
import { Loader2, Trash2 } from "lucide-react";
import {
  deleteProjectAction,
  type ProjectActionState,
} from "@/app/projects/actions";
import { Button } from "@/components/ui/button";

const initialState: ProjectActionState = {};

export function DeleteProjectButton({ projectId, projectName }: { projectId: string; projectName: string }) {
  const [state, formAction, pending] = useActionState(deleteProjectAction, initialState);

  return (
    <form
      action={formAction}
      onSubmit={(event) => {
        if (!window.confirm(`Permanently delete “${projectName}” and every ticket and comment in it? This cannot be undone.`)) {
          event.preventDefault();
        }
      }}
    >
      <input name="projectId" type="hidden" value={projectId} />
      <Button disabled={pending} type="submit" variant="outline">
        {pending ? <Loader2 aria-hidden="true" className="animate-spin" /> : <Trash2 aria-hidden="true" className="text-red-600" />}
        {pending ? "Deleting…" : "Delete project"}
      </Button>
      {state.error && <p className="mt-2 text-xs text-red-600" role="alert">{state.error}</p>}
    </form>
  );
}
