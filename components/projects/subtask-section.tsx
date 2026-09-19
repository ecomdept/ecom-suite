"use client";

import { useActionState } from "react";
import { CalendarDays, CheckCircle2, Circle, Clock3, Loader2, Pencil, Plus, Save, Trash2 } from "lucide-react";
import {
  createSubtaskAction,
  deleteSubtaskAction,
  setSubtaskCompletionAction,
  updateSubtaskAction,
  type ProjectActionState,
} from "@/app/projects/actions";
import { FormMessage } from "@/components/auth/form-message";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { TicketMemberOption } from "@/components/projects/create-ticket-form";

type Subtask = {
  id: string;
  title: string;
  description: string | null;
  due_date: string | null;
  assignee_id: string | null;
  is_completed: boolean;
  estimated_hours: number;
  logged_hours: number;
};

const initialState: ProjectActionState = {};

function formatDueDate(value: string) {
  return new Intl.DateTimeFormat("en", {
    month: "short",
    day: "numeric",
    year: "numeric",
    timeZone: "UTC",
  }).format(new Date(`${value}T00:00:00Z`));
}

export function SubtaskSection({ projectId, ticketId, subtasks, members, canWork, clientView = false }: { projectId: string; ticketId: string; subtasks: Subtask[]; members: TicketMemberOption[]; canWork: boolean; clientView?: boolean }) {
  const [state, formAction, pending] = useActionState(createSubtaskAction, initialState);
  const completed = subtasks.filter((subtask) => subtask.is_completed).length;
  const memberNames = new Map(members.map((member) => [member.id, member.name]));
  const progress = subtasks.length ? Math.round((completed / subtasks.length) * 100) : 0;

  return (
    <section aria-labelledby="subtasks-heading" className="rounded-2xl border border-stone-200 bg-white shadow-sm">
      <div className="border-b border-stone-100 px-5 py-5 sm:px-7">
        <div className="flex items-center justify-between gap-4"><div><h2 className="text-lg font-semibold" id="subtasks-heading">{clientView ? "Delivery checkpoints" : "Subtasks"}</h2><p className="mt-1 text-xs text-slate-500">{completed} of {subtasks.length} completed</p></div><span className="text-sm font-semibold text-slate-600">{progress}%</span></div>
        <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-stone-100"><div className="h-full rounded-full bg-emerald-500 transition-all" style={{ width: `${progress}%` }} /></div>
      </div>

      <div className="divide-y divide-slate-100">
        {subtasks.map((subtask) => (
          <article className="flex scroll-mt-6 items-start gap-3 px-5 py-4 sm:px-7" id={`subtask-${subtask.id}`} key={subtask.id}>
            {canWork ? (
              <form action={setSubtaskCompletionAction}>
                <input name="projectId" type="hidden" value={projectId} /><input name="ticketId" type="hidden" value={ticketId} /><input name="subtaskId" type="hidden" value={subtask.id} /><input name="isCompleted" type="hidden" value={String(!subtask.is_completed)} />
                <button aria-label={subtask.is_completed ? `Mark ${subtask.title} incomplete` : `Mark ${subtask.title} complete`} className="mt-0.5 text-slate-400 hover:text-emerald-600" type="submit">{subtask.is_completed ? <CheckCircle2 aria-hidden="true" className="size-5 text-emerald-500" /> : <Circle aria-hidden="true" className="size-5" />}</button>
              </form>
            ) : subtask.is_completed ? <CheckCircle2 aria-hidden="true" className="mt-0.5 size-5 text-emerald-500" /> : <Circle aria-hidden="true" className="mt-0.5 size-5 text-slate-300" />}
            <div className="min-w-0 flex-1"><h3 className={`text-sm font-medium ${subtask.is_completed ? "text-slate-400 line-through" : "text-slate-900"}`}>{subtask.title}</h3>{!clientView && subtask.description && <p className="mt-1 whitespace-pre-wrap text-xs leading-5 text-slate-500">{subtask.description}</p>}<div className="mt-2 flex flex-wrap gap-3 text-xs text-slate-400">{!clientView && subtask.assignee_id && <span>{memberNames.get(subtask.assignee_id) || "Project member"}</span>}{subtask.due_date && <span className="flex items-center gap-1"><CalendarDays aria-hidden="true" className="size-3" />Due {formatDueDate(subtask.due_date)}</span>}{!clientView && <span className="flex items-center gap-1"><Clock3 aria-hidden="true" className="size-3" />{Number(subtask.estimated_hours).toFixed(1)}h estimated · {Number(subtask.logged_hours).toFixed(1)}h logged</span>}</div></div>
            {canWork && <div className="flex"><details className="relative"><summary className="grid size-9 cursor-pointer list-none place-items-center rounded-md text-slate-400 hover:bg-stone-100 hover:text-slate-700" title="Edit subtask"><Pencil aria-hidden="true" className="size-4" /><span className="sr-only">Edit {subtask.title}</span></summary><form action={updateSubtaskAction} className="absolute right-0 z-20 mt-2 grid w-[min(22rem,calc(100vw-3rem))] gap-3 rounded-xl border border-stone-200 bg-white p-4 shadow-xl"><input name="projectId" type="hidden" value={projectId} /><input name="ticketId" type="hidden" value={ticketId} /><input name="subtaskId" type="hidden" value={subtask.id} /><div className="space-y-1.5"><Label htmlFor={`edit-subtask-title-${subtask.id}`}>Title</Label><Input defaultValue={subtask.title} id={`edit-subtask-title-${subtask.id}`} maxLength={200} minLength={2} name="title" required /></div><div className="space-y-1.5"><Label htmlFor={`edit-subtask-description-${subtask.id}`}>Description</Label><textarea className="min-h-20 w-full rounded-md border border-input px-3 py-2 text-sm" defaultValue={subtask.description ?? ""} id={`edit-subtask-description-${subtask.id}`} maxLength={2000} name="description" /></div><div className="space-y-1.5"><Label htmlFor={`edit-subtask-assignee-${subtask.id}`}>Assignee</Label><select className="flex h-10 w-full rounded-md border border-input bg-white px-3 text-sm" defaultValue={subtask.assignee_id ?? ""} id={`edit-subtask-assignee-${subtask.id}`} name="assigneeId"><option value="">Unassigned</option>{members.map((member) => <option key={member.id} value={member.id}>{member.name}</option>)}</select></div><div className="space-y-1.5"><Label htmlFor={`edit-subtask-due-${subtask.id}`}>Due date</Label><Input defaultValue={subtask.due_date ?? ""} id={`edit-subtask-due-${subtask.id}`} name="dueDate" type="date" /></div><div className="grid grid-cols-2 gap-3"><div className="space-y-1.5"><Label htmlFor={`edit-subtask-estimate-${subtask.id}`}>Estimate</Label><Input defaultValue={subtask.estimated_hours} id={`edit-subtask-estimate-${subtask.id}`} min="0" name="estimatedHours" step="0.25" type="number" /></div><div className="space-y-1.5"><Label htmlFor={`edit-subtask-logged-${subtask.id}`}>Logged</Label><Input defaultValue={subtask.logged_hours} id={`edit-subtask-logged-${subtask.id}`} min="0" name="loggedHours" step="0.25" type="number" /></div></div><Button size="sm" type="submit"><Save aria-hidden="true" />Save subtask</Button></form></details><form action={deleteSubtaskAction}><input name="projectId" type="hidden" value={projectId} /><input name="ticketId" type="hidden" value={ticketId} /><input name="subtaskId" type="hidden" value={subtask.id} /><Button aria-label={`Delete ${subtask.title}`} className="text-slate-400 hover:text-red-600" size="icon" title="Delete subtask" type="submit" variant="ghost"><Trash2 aria-hidden="true" /></Button></form></div>}
          </article>
        ))}
        {!subtasks.length && <p className="px-5 py-8 text-center text-sm text-slate-500 sm:px-7">{clientView ? "No delivery checkpoints yet." : "No subtasks yet."}</p>}
      </div>

      {canWork && (
        <form action={formAction} className="grid gap-4 border-t border-stone-100 bg-slate-50/60 p-5 sm:p-7">
          <input name="projectId" type="hidden" value={projectId} /><input name="ticketId" type="hidden" value={ticketId} />
          <h3 className="text-sm font-semibold">Add a subtask</h3>
          <div className="space-y-2"><Label htmlFor="subtask-title">Title</Label><Input id="subtask-title" maxLength={200} minLength={2} name="title" placeholder="Implement responsive empty state" required /></div>
          <div className="space-y-2"><Label htmlFor="subtask-description">Description</Label><textarea className="min-h-20 w-full rounded-md border border-input bg-white px-3 py-2 text-sm shadow-sm outline-none focus-visible:ring-1 focus-visible:ring-ring" id="subtask-description" maxLength={2000} name="description" /></div>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4"><div className="space-y-2"><Label htmlFor="subtask-assignee">Assignee</Label><select className="flex h-10 w-full rounded-md border border-input bg-white px-3 text-sm shadow-sm outline-none focus-visible:ring-1 focus-visible:ring-ring" defaultValue="" id="subtask-assignee" name="assigneeId"><option value="">Unassigned</option>{members.map((member) => <option key={member.id} value={member.id}>{member.name}</option>)}</select></div><div className="space-y-2"><Label htmlFor="subtask-due-date">Due date</Label><Input id="subtask-due-date" name="dueDate" type="date" /></div><div className="space-y-2"><Label htmlFor="subtask-estimate">Estimated hours</Label><Input id="subtask-estimate" min="0" name="estimatedHours" step="0.25" type="number" /></div><div className="space-y-2"><Label htmlFor="subtask-logged">Logged hours</Label><Input id="subtask-logged" min="0" name="loggedHours" step="0.25" type="number" /></div></div>
          <FormMessage error={state.error} success={state.success} />
          <Button className="justify-self-start" disabled={pending} type="submit" variant="outline">{pending ? <Loader2 aria-hidden="true" className="animate-spin" /> : <Plus aria-hidden="true" />}{pending ? "Adding…" : "Add subtask"}</Button>
        </form>
      )}
    </section>
  );
}
