"use client";

import { useActionState } from "react";
import { Loader2, Trash2 } from "lucide-react";
import {
  deleteUserAction,
  type DeleteUserActionState,
} from "@/app/dashboard/actions";
import { Button } from "@/components/ui/button";

const initialState: DeleteUserActionState = {};

export function DeleteUserButton({ userId, userName }: { userId: string; userName: string }) {
  const [state, formAction, pending] = useActionState(deleteUserAction, initialState);

  return (
    <form
      action={formAction}
      className="flex flex-col items-end gap-1"
      onSubmit={(event) => {
        if (!window.confirm(`Permanently delete ${userName}? They will immediately lose access. This cannot be undone.`)) {
          event.preventDefault();
        }
      }}
    >
      <input name="userId" type="hidden" value={userId} />
      <Button aria-label={`Delete ${userName}`} disabled={pending} size="icon" title={state.error ?? `Delete ${userName}`} type="submit" variant="ghost">
        {pending ? <Loader2 aria-hidden="true" className="animate-spin" /> : <Trash2 aria-hidden="true" className="text-red-600" />}
      </Button>
      {state.error && <span className="max-w-52 text-right text-xs text-red-600" role="alert">{state.error}</span>}
    </form>
  );
}
