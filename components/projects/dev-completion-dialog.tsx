"use client";

import { useActionState, useEffect, useRef } from "react";
import { CheckCircle2, ExternalLink, Loader2, X } from "lucide-react";
import { completeDevSubtaskAction, type ProjectActionState } from "@/app/projects/actions";
import { FormMessage } from "@/components/auth/form-message";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { RichTextEditor } from "@/components/ui/rich-text-editor";

const initialState: ProjectActionState = {};

export function DevCompletionDialog({ projectId, ticketId, subtaskId, title, pullRequestUrl, previewUrl, devNotes }: { projectId: string; ticketId: string; subtaskId: string; title: string; pullRequestUrl?: string | null; previewUrl?: string | null; devNotes?: string | null }) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const [state, action, pending] = useActionState(completeDevSubtaskAction, initialState);
  useEffect(() => { if (state.success) dialogRef.current?.close(); }, [state.success]);
  return <>
    <button aria-label={`Complete ${title}`} className="mt-0.5 text-slate-400 hover:text-emerald-600" onClick={() => dialogRef.current?.showModal()} type="button"><CheckCircle2 aria-hidden="true" className="size-5"/></button>
    <dialog aria-labelledby={`dev-handoff-${subtaskId}`} className="m-auto w-[calc(100%_-_2rem)] max-w-xl rounded-2xl border border-stone-200 bg-white p-0 text-slate-950 shadow-2xl backdrop:bg-slate-950/55" ref={dialogRef}>
      <div className="flex items-start justify-between gap-4 border-b border-stone-100 px-5 py-4"><div><p className="text-xs font-semibold uppercase tracking-wider text-pink-600">Development handoff</p><h2 className="mt-1 text-xl font-semibold" id={`dev-handoff-${subtaskId}`}>Complete development</h2></div><Button aria-label="Close" onClick={() => dialogRef.current?.close()} size="icon" type="button" variant="ghost"><X/></Button></div>
      <form action={action} className="grid gap-4 p-5 sm:p-6"><input name="projectId" type="hidden" value={projectId}/><input name="ticketId" type="hidden" value={ticketId}/><input name="subtaskId" type="hidden" value={subtaskId}/><p className="text-sm leading-6 text-slate-500">Confirm the implementation evidence QA needs. Previously saved ticket or handoff links are filled in automatically and can be replaced here.</p><div className="space-y-2"><Label htmlFor={`pr-${subtaskId}`}>GitHub pull request link</Label><Input defaultValue={pullRequestUrl ?? ""} id={`pr-${subtaskId}`} name="pullRequestUrl" placeholder="https://github.com/org/repo/pull/123" required type="url"/><p className="flex items-center gap-1 text-xs text-slate-400"><ExternalLink className="size-3"/>{pullRequestUrl ? "Saved from the existing handoff or ticket" : "Required"}</p></div><div className="space-y-2"><Label htmlFor={`preview-${subtaskId}`}>Preview link</Label><Input defaultValue={previewUrl ?? ""} id={`preview-${subtaskId}`} name="previewUrl" placeholder="https://preview.example.com" required type="url"/><p className="flex items-center gap-1 text-xs text-slate-400"><ExternalLink className="size-3"/>{previewUrl ? "Saved from the existing handoff or ticket" : "Required"}</p></div><div className="space-y-2"><Label htmlFor={`dev-notes-${subtaskId}`}>Development notes <span className="font-normal text-slate-400">(optional)</span></Label><RichTextEditor defaultValue={devNotes ?? ""} id={`dev-notes-${subtaskId}`} maxLength={10000} minHeight="min-h-24" name="devNotes" placeholder="Implementation details, testing notes, or areas QA should focus on…"/></div><FormMessage error={state.error}/><Button className="justify-self-start bg-emerald-600 hover:bg-emerald-500" disabled={pending} type="submit">{pending ? <Loader2 className="animate-spin"/> : <CheckCircle2/>}{pending ? "Completing…" : "Complete and send to QA"}</Button></form>
    </dialog>
  </>;
}
