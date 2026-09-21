"use client";

import { useActionState, useState } from "react";
import { Loader2, Pencil, Save } from "lucide-react";
import { updateTicketDetailsAction, type ProjectActionState } from "@/app/projects/actions";
import { FormMessage } from "@/components/auth/form-message";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { RichTextEditor } from "@/components/ui/rich-text-editor";
import type { TicketMemberOption } from "@/components/projects/create-ticket-form";
import type { TicketPriority, TicketType } from "@/lib/projects/validation";

type EditableTicket = {
  title: string;
  description: string | null;
  ticket_type: TicketType;
  priority: TicketPriority;
  acceptance_criteria: string | null;
  reproduction_steps: string | null;
  expected_behavior: string | null;
  actual_behavior: string | null;
  affected_platforms: string[];
  reference_url: string | null;
  preview_url: string | null;
  repository_url: string | null;
  design_url: string | null;
  dev_notes: string | null;
  assignee_id: string | null;
  due_date: string | null;
};

const initialState: ProjectActionState = {};

export function TicketDetailsForm({ projectId, ticketId, ticket, members }: { projectId: string; ticketId: string; ticket: EditableTicket; members: TicketMemberOption[] }) {
  const [state, formAction, pending] = useActionState(updateTicketDetailsAction, initialState);
  const [ticketType, setTicketType] = useState<TicketType>(ticket.ticket_type);

  return (
    <details className="rounded-2xl border border-stone-200 bg-white shadow-sm">
      <summary className="flex cursor-pointer list-none items-center gap-2 px-5 py-4 font-medium marker:hidden sm:px-7"><Pencil aria-hidden="true" className="size-4 text-pink-600" />Edit ticket details</summary>
      <form action={formAction} className="grid gap-5 border-t border-stone-100 p-5 sm:p-7">
        <input name="projectId" type="hidden" value={projectId} />
        <input name="ticketId" type="hidden" value={ticketId} />
        <div className="space-y-2"><Label htmlFor="edit-ticket-title">Title</Label><Input defaultValue={ticket.title} id="edit-ticket-title" maxLength={140} minLength={2} name="title" required /></div>
        <div className="space-y-2"><Label htmlFor="edit-ticket-description">Description</Label><RichTextEditor defaultValue={ticket.description ?? ""} id="edit-ticket-description" maxLength={2000} name="description" /></div>
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2"><Label htmlFor="edit-ticket-type">Work type</Label><select className="flex h-10 w-full rounded-md border border-input bg-white px-3 text-sm shadow-sm" id="edit-ticket-type" name="ticketType" onChange={(event) => setTicketType(event.target.value as TicketType)} value={ticketType}><option value="new_feature">New feature</option><option value="feature_update">Update existing feature</option><option value="bug">Bug</option></select></div>
          <div className="space-y-2"><Label htmlFor="edit-ticket-priority">Priority</Label><select className="flex h-10 w-full rounded-md border border-input bg-white px-3 text-sm shadow-sm" defaultValue={ticket.priority} id="edit-ticket-priority" name="priority"><option value="low">Low</option><option value="medium">Medium</option><option value="high">High</option></select></div>
        </div>
        {ticketType === "bug" ? (
          <div className="grid gap-4 rounded-xl border border-red-100 bg-red-50/50 p-4">
            <fieldset className="space-y-2"><legend className="text-sm font-medium">Affected platform</legend><div className="flex flex-wrap gap-4">{["desktop", "mobile", "tablet"].map((platform) => <label className="flex items-center gap-2 text-sm capitalize" key={platform}><input className="size-4" defaultChecked={ticket.affected_platforms.includes(platform)} name="affectedPlatforms" type="checkbox" value={platform} />{platform}</label>)}</div></fieldset>
            <div className="space-y-2"><Label htmlFor="edit-reproduction">Steps to reproduce</Label><RichTextEditor defaultValue={ticket.reproduction_steps ?? ""} id="edit-reproduction" maxLength={5000} name="reproductionSteps" /></div>
            <div className="grid gap-4 sm:grid-cols-2"><div className="space-y-2"><Label htmlFor="edit-expected">Expected behavior</Label><RichTextEditor defaultValue={ticket.expected_behavior ?? ""} id="edit-expected" maxLength={3000} minHeight="min-h-24" name="expectedBehavior" /></div><div className="space-y-2"><Label htmlFor="edit-actual">Actual behavior</Label><RichTextEditor defaultValue={ticket.actual_behavior ?? ""} id="edit-actual" maxLength={3000} minHeight="min-h-24" name="actualBehavior" /></div></div>
          </div>
        ) : <div className="space-y-2"><Label htmlFor="edit-acceptance">Acceptance criteria</Label><RichTextEditor defaultValue={ticket.acceptance_criteria ?? ""} id="edit-acceptance" maxLength={5000} name="acceptanceCriteria" /></div>}
        <fieldset className="grid gap-4 rounded-xl border border-stone-200 p-4 sm:grid-cols-2">
          <legend className="px-1 text-sm font-medium">Assignment and references</legend>
          <div className="space-y-2"><Label htmlFor="edit-assignee">Assignee</Label><select className="flex h-10 w-full rounded-md border border-input bg-white px-3 text-sm shadow-sm" defaultValue={ticket.assignee_id ?? ""} id="edit-assignee" name="assigneeId"><option value="">Unassigned</option>{members.map((member) => <option key={member.id} value={member.id}>{member.name}</option>)}</select></div>
          <div className="space-y-2"><Label htmlFor="edit-due-date">Due date</Label><Input defaultValue={ticket.due_date ?? ""} id="edit-due-date" name="dueDate" type="date" /></div>
          <div className="space-y-2"><Label htmlFor="edit-reference-url">Reference URL</Label><Input defaultValue={ticket.reference_url ?? ""} id="edit-reference-url" maxLength={2000} name="referenceUrl" type="url" /></div>
          <div className="space-y-2"><Label htmlFor="edit-preview-url">Preview or staging URL</Label><Input defaultValue={ticket.preview_url ?? ""} id="edit-preview-url" maxLength={2000} name="previewUrl" type="url" /></div>
          <div className="space-y-2"><Label htmlFor="edit-design-url">Design URL</Label><Input defaultValue={ticket.design_url ?? ""} id="edit-design-url" maxLength={2000} name="designUrl" type="url" /></div>
          <div className="space-y-2"><Label htmlFor="edit-repository-url">GitHub repository</Label><Input defaultValue={ticket.repository_url ?? ""} id="edit-repository-url" maxLength={2000} name="repositoryUrl" type="url" /></div>
        </fieldset>
        <div className="space-y-2"><Label htmlFor="edit-dev-notes">Development notes</Label><RichTextEditor defaultValue={ticket.dev_notes ?? ""} id="edit-dev-notes" maxLength={10000} name="devNotes" /></div>
        <FormMessage error={state.error} success={state.success} />
        <Button className="justify-self-start" disabled={pending} type="submit">{pending ? <Loader2 aria-hidden="true" className="animate-spin" /> : <Save aria-hidden="true" />}{pending ? "Saving…" : "Save ticket details"}</Button>
      </form>
    </details>
  );
}
