"use client";

import { useActionState } from "react";
import Link from "next/link";
import { Check, Loader2, Pencil, Save } from "lucide-react";
import { updateTimesheetEntryAction, type TimesheetActionState } from "@/app/timesheets/actions";
import { Button } from "@/components/ui/button";
import { DatePicker } from "@/components/ui/date-picker";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

const initialState: TimesheetActionState = {};

export type TimesheetEntryView = {
  id: string;
  projectId: string;
  ticketId: string;
  taskTitle: string;
  subtaskTitle: string | null;
  projectName: string;
  personName: string;
  workDate: string;
  hours: number;
  canEdit: boolean;
  canOpenTask: boolean;
};

export function TimesheetEntryRow({ entry, showPerson }: { entry: TimesheetEntryView; showPerson: boolean }) {
  const [state, action, pending] = useActionState(updateTimesheetEntryAction, initialState);
  const taskLabel = entry.subtaskTitle ? `${entry.taskTitle} · ${entry.subtaskTitle}` : entry.taskTitle;

  return (
    <article className="grid gap-4 px-5 py-5 sm:px-7 lg:grid-cols-[minmax(0,1fr)_150px_100px_auto] lg:items-center">
      <div className="min-w-0"><div className="flex flex-wrap items-center gap-2">{entry.hours < 0 && <span className="rounded bg-amber-50 px-2 py-0.5 text-[10px] font-semibold uppercase text-amber-700">Adjustment</span>}{showPerson && <span className="rounded bg-stone-100 px-2 py-0.5 text-[10px] font-semibold uppercase text-slate-500">{entry.personName}</span>}</div>{entry.canOpenTask ? <Link className="mt-2 block truncate font-semibold text-slate-900 hover:text-pink-600" href={`/projects/${entry.projectId}/tickets/${entry.ticketId}`}>{taskLabel}</Link> : <p className="mt-2 truncate font-semibold text-slate-900">{taskLabel}</p>}<p className="mt-1 text-xs text-slate-500">{entry.projectName}</p></div>
      <div><p className="text-[10px] font-semibold uppercase tracking-wide text-slate-400 lg:hidden">Date</p><p className="mt-1 text-sm text-slate-600 lg:mt-0">{new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", year: "numeric", timeZone: "UTC" }).format(new Date(`${entry.workDate}T00:00:00.000Z`))}</p></div>
      <div><p className="text-[10px] font-semibold uppercase tracking-wide text-slate-400 lg:hidden">Time</p><p className={`mt-1 text-sm font-semibold lg:mt-0 ${entry.hours < 0 ? "text-amber-700" : "text-slate-900"}`}>{entry.hours.toFixed(2)}h</p></div>
      <div>{entry.canEdit ? <details className="relative"><summary className="flex h-9 cursor-pointer list-none items-center justify-center gap-2 rounded-md border border-stone-200 px-3 text-xs font-medium hover:bg-stone-50"><Pencil aria-hidden="true" className="size-3.5" />Edit</summary><form action={action} className="absolute right-0 z-20 mt-2 grid w-[min(24rem,calc(100vw-3rem))] gap-4 rounded-xl border border-stone-200 bg-white p-4 shadow-xl"><input name="entryId" type="hidden" value={entry.id} /><div className="grid gap-3 sm:grid-cols-2"><div className="space-y-1.5"><Label htmlFor={`entry-date-${entry.id}`}>Work date</Label><DatePicker defaultValue={entry.workDate} id={`entry-date-${entry.id}`} name="workDate" required /></div><div className="space-y-1.5"><Label htmlFor={`entry-hours-${entry.id}`}>Hours</Label><Input defaultValue={entry.hours} id={`entry-hours-${entry.id}`} max="24" min="-24" name="hours" required step="0.25" type="number" /></div></div>{state.error && <p className="text-xs text-red-600" role="alert">{state.error}</p>}{state.success && <p className="flex items-center gap-1 text-xs text-emerald-600"><Check aria-hidden="true" className="size-3" />{state.success}</p>}<Button disabled={pending} size="sm" type="submit">{pending ? <Loader2 aria-hidden="true" className="animate-spin" /> : <Save aria-hidden="true" />}{pending ? "Saving…" : "Save entry"}</Button></form></details> : <span className="text-xs text-slate-400">View only</span>}</div>
    </article>
  );
}
