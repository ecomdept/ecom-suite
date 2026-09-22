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

export function TicketUsageForm({ projectId, ticketId, directLoggedHours, subtaskLoggedHours, hourlyRate }: { projectId: string; ticketId: string; directLoggedHours: number; subtaskLoggedHours: number; hourlyRate: number | null }) {
  const [state, formAction, pending] = useActionState(updateTicketUsageAction, initialState);

  return (
    <form action={formAction} className="grid gap-4">
      <input name="projectId" type="hidden" value={projectId} /><input name="ticketId" type="hidden" value={ticketId} />
      <div><h2 className="flex items-center gap-2 font-semibold"><Clock3 aria-hidden="true" className="size-4 text-pink-600" />Usage tracking</h2><p className="mt-1 text-xs text-slate-500">Logged-hour changes are recorded against the active two-week sprint.</p></div>
      <div className="space-y-2"><Label htmlFor="usage-logged">Direct ticket hours</Label><Input defaultValue={directLoggedHours} id="usage-logged" min="0" name="loggedHours" step="0.25" type="number" /><p className="text-[11px] text-slate-400">Use for work not logged against a subtask. Approved estimates are changed through the client approval workflow.</p></div>
      <div className="grid grid-cols-2 gap-3 rounded-lg bg-stone-50 px-3 py-3 text-xs"><div><p className="text-slate-400">Subtask hours</p><p className="mt-1 font-semibold text-slate-700">{subtaskLoggedHours.toFixed(1)}h</p></div><div><p className="text-slate-400">Total logged</p><p className="mt-1 font-semibold text-slate-900">{(directLoggedHours + subtaskLoggedHours).toFixed(1)}h</p></div></div>
      {hourlyRate !== null && <p className="rounded-lg bg-stone-50 px-3 py-2 text-xs text-slate-500">Billing is calculated automatically at ${hourlyRate.toLocaleString("en-US", { maximumFractionDigits: 2 })}/hour.</p>}
      <FormMessage error={state.error} success={state.success} />
      <Button className="justify-self-start" disabled={pending} type="submit" variant="outline">{pending ? <Loader2 aria-hidden="true" className="animate-spin" /> : <Save aria-hidden="true" />}{pending ? "Saving…" : "Save usage"}</Button>
    </form>
  );
}
