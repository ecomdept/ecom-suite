"use client";

import { useActionState } from "react";
import { Clock3, Loader2, Save } from "lucide-react";
import {
  updateTicketUsageAction,
  type ProjectActionState,
} from "@/app/projects/actions";
import { FormMessage } from "@/components/auth/form-message";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

const initialState: ProjectActionState = {};

export function TicketUsageForm({ projectId, ticketId, estimatedHours, loggedHours, billableAmount, currency }: { projectId: string; ticketId: string; estimatedHours: number; loggedHours: number; billableAmount: number; currency: string }) {
  const [state, formAction, pending] = useActionState(updateTicketUsageAction, initialState);

  return (
    <form action={formAction} className="grid gap-4">
      <input name="projectId" type="hidden" value={projectId} /><input name="ticketId" type="hidden" value={ticketId} />
      <div><h2 className="flex items-center gap-2 font-semibold"><Clock3 aria-hidden="true" className="size-4 text-pink-600" />Usage tracking</h2><p className="mt-1 text-xs text-slate-500">Update the hours and amount reflected in project analytics.</p></div>
      <div className="grid gap-4 sm:grid-cols-3">
        <div className="space-y-2"><Label htmlFor="usage-estimated">Estimated hours</Label><Input defaultValue={estimatedHours} id="usage-estimated" min="0" name="estimatedHours" step="0.25" type="number" /></div>
        <div className="space-y-2"><Label htmlFor="usage-logged">Logged hours</Label><Input defaultValue={loggedHours} id="usage-logged" min="0" name="loggedHours" step="0.25" type="number" /></div>
        <div className="space-y-2"><Label htmlFor="usage-billable">Billable amount ({currency})</Label><Input defaultValue={billableAmount} id="usage-billable" min="0" name="billableAmount" step="0.01" type="number" /></div>
      </div>
      <FormMessage error={state.error} success={state.success} />
      <Button className="justify-self-start" disabled={pending} type="submit" variant="outline">{pending ? <Loader2 aria-hidden="true" className="animate-spin" /> : <Save aria-hidden="true" />}{pending ? "Saving…" : "Save usage"}</Button>
    </form>
  );
}
