"use client";

import { useActionState, useEffect, useState } from "react";
import { Loader2, Plus } from "lucide-react";
import {
  createTicketAction,
  type ProjectActionState,
} from "@/app/projects/actions";
import { FormMessage } from "@/components/auth/form-message";
import { Button } from "@/components/ui/button";
import { DatePicker } from "@/components/ui/date-picker";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { RichTextEditor } from "@/components/ui/rich-text-editor";
import type { TicketType } from "@/lib/projects/validation";

export type TicketMemberOption = { id: string; name: string };

const initialState: ProjectActionState = {};

export function CreateTicketForm({
  projectId,
  onCreated,
  clientRequest = false,
  canPlan = false,
  members = [],
}: {
  projectId: string;
  onCreated?: () => void;
  clientRequest?: boolean;
  canPlan?: boolean;
  members?: TicketMemberOption[];
}) {
  const [state, formAction, pending] = useActionState(createTicketAction, initialState);
  const [ticketType, setTicketType] = useState<TicketType>("new_feature");

  useEffect(() => {
    if (state.success) onCreated?.();
  }, [state.success, onCreated]);

  return (
    <form action={formAction} className="grid gap-4">
      <input name="projectId" type="hidden" value={projectId} />
      <div className="space-y-2">
        <Label htmlFor="ticket-title">{clientRequest ? "What do you need?" : "Ticket title"} <span className="text-pink-600">*</span></Label>
        <Input autoFocus id="ticket-title" maxLength={140} minLength={2} name="title" placeholder={ticketType === "bug" ? "Checkout button fails on mobile" : clientRequest ? "A short, clear summary of your request" : "Add checkout validation"} required />
      </div>
      <div className="space-y-2">
        <Label htmlFor="ticket-type">{clientRequest ? "Request type" : "Work type"}</Label>
        <select className="flex h-10 w-full rounded-md border border-input bg-transparent px-3 text-sm shadow-sm outline-none focus-visible:ring-1 focus-visible:ring-ring" id="ticket-type" name="ticketType" onChange={(event) => setTicketType(event.target.value as TicketType)} value={ticketType}>
          <option value="new_feature">New feature</option>
          <option value="feature_update">Update existing feature</option>
          <option value="bug">Bug</option>
        </select>
        <p className="text-xs text-slate-500">
          {ticketType === "bug" ? "Share what went wrong. Add the extra details you know—we can help investigate the rest." : ticketType === "feature_update" ? "Tell us what should change about something that already exists." : "Describe a new capability, page, campaign, or experience."}
        </p>
      </div>
      <div className="space-y-2">
        <Label htmlFor="ticket-description">{ticketType === "bug" ? "Issue summary" : "Description and user need"}</Label>
        <RichTextEditor
          id="ticket-description"
          maxLength={2000}
          name="description"
          placeholder={ticketType === "bug" ? "Summarize the issue, its impact, and when it started." : ticketType === "feature_update" ? "Describe the existing feature and what needs to change." : "As a user, I want… so that…"}
        />
        <p className="text-xs text-slate-500">Optional, but context helps us scope and respond faster.</p>
      </div>
      {ticketType === "bug" ? (
        <div className="grid gap-4 rounded-xl border border-red-100 bg-red-50/50 p-4">
          <fieldset className="space-y-2"><legend className="text-sm font-medium">Affected platform</legend><div className="flex flex-wrap gap-4">{["desktop", "mobile", "tablet"].map((platform) => <label className="flex items-center gap-2 text-sm capitalize" key={platform}><input className="size-4 rounded border-slate-300" name="affectedPlatforms" type="checkbox" value={platform} />{platform}</label>)}</div></fieldset>
          <div className="space-y-2"><Label htmlFor="ticket-reproduction">Steps to reproduce <span className="font-normal text-slate-400">(optional)</span></Label><RichTextEditor id="ticket-reproduction" maxLength={5000} name="reproductionSteps" placeholder={"1. Open…\n2. Select…\n3. Observe…"} /></div>
          <div className="grid gap-4 sm:grid-cols-2"><div className="space-y-2"><Label htmlFor="ticket-expected">What did you expect? <span className="font-normal text-slate-400">(optional)</span></Label><RichTextEditor id="ticket-expected" maxLength={3000} minHeight="min-h-24" name="expectedBehavior" /></div><div className="space-y-2"><Label htmlFor="ticket-actual">What happened instead? <span className="font-normal text-slate-400">(optional)</span></Label><RichTextEditor id="ticket-actual" maxLength={3000} minHeight="min-h-24" name="actualBehavior" /></div></div>
        </div>
      ) : (
        <div className="space-y-2"><Label htmlFor="ticket-acceptance">{clientRequest ? "What would a successful result look like?" : "Acceptance criteria"} <span className="font-normal text-slate-400">(optional)</span></Label><RichTextEditor id="ticket-acceptance" maxLength={5000} name="acceptanceCriteria" placeholder={clientRequest ? "Describe the outcome you want to review or approve." : "- Given… when… then…\n- The user can…\n- The feature handles…"} /></div>
      )}
      <div className="space-y-2">
        <Label htmlFor="ticket-priority">{clientRequest ? "Business urgency" : "Priority"}</Label>
        <select className="flex h-10 w-full rounded-md border border-input bg-transparent px-3 text-sm shadow-sm outline-none focus-visible:ring-1 focus-visible:ring-ring" defaultValue="medium" id="ticket-priority" name="priority">
          <option value="low">{clientRequest ? "Flexible" : "Low"}</option>
          <option value="medium">{clientRequest ? "Normal" : "Medium"}</option>
          <option value="high">{clientRequest ? "Time-sensitive" : "High"}</option>
        </select>
        {clientRequest && <p className="text-xs text-slate-500">We’ll confirm final priority and timing after reviewing the request.</p>}
      </div>
      <fieldset className="grid gap-4 rounded-xl border border-stone-200 p-4 sm:grid-cols-2">
        <legend className="px-1 text-sm font-medium">{clientRequest ? "Helpful links (optional)" : "References and delivery links"}</legend>
        <div className="space-y-2"><Label htmlFor="ticket-reference-url">Reference link</Label><Input id="ticket-reference-url" maxLength={2000} name="referenceUrl" placeholder={clientRequest ? "Page, brief, example, or Loom URL" : "https://…"} type="url" /></div>
        <div className="space-y-2"><Label htmlFor="ticket-design-url">Design link</Label><Input id="ticket-design-url" maxLength={2000} name="designUrl" placeholder="https://figma.com/…" type="url" /></div>
        {!clientRequest && <><div className="space-y-2"><Label htmlFor="ticket-preview-url">Preview or staging URL</Label><Input id="ticket-preview-url" maxLength={2000} name="previewUrl" placeholder="https://…" type="url" /></div><div className="space-y-2"><Label htmlFor="ticket-repository-url">GitHub repository</Label><Input id="ticket-repository-url" maxLength={2000} name="repositoryUrl" placeholder="https://github.com/…" type="url" /></div></>}
      </fieldset>
      {!clientRequest && canPlan && (
        <fieldset className="grid gap-4 rounded-xl border border-stone-200 p-4 sm:grid-cols-3">
          <legend className="px-1 text-sm font-medium">Planning</legend>
          <div className="space-y-2"><Label htmlFor="ticket-assignee">Assignee</Label><select className="flex h-10 w-full rounded-md border border-input bg-transparent px-3 text-sm shadow-sm outline-none focus-visible:ring-1 focus-visible:ring-ring" defaultValue="" id="ticket-assignee" name="assigneeId"><option value="">Unassigned</option>{members.map((member) => <option key={member.id} value={member.id}>{member.name}</option>)}</select></div>
          <div className="space-y-2"><Label htmlFor="ticket-due-date">Due date</Label><DatePicker id="ticket-due-date" name="dueDate" /></div>
          <div className="space-y-2"><Label htmlFor="ticket-estimated-hours">Estimated hours</Label><Input id="ticket-estimated-hours" min="0" name="estimatedHours" placeholder="2.5" step="0.25" type="number" /></div>
          <div className="space-y-2 sm:col-span-3"><Label htmlFor="ticket-dev-notes">Development notes</Label><RichTextEditor id="ticket-dev-notes" maxLength={10000} name="devNotes" placeholder="Implementation considerations, dependencies, technical constraints…" /></div>
        </fieldset>
      )}
      <FormMessage error={state.error} success={state.success} />
      <Button className="justify-self-start bg-pink-600 hover:bg-pink-500" disabled={pending} type="submit">
        {pending ? <Loader2 aria-hidden="true" className="animate-spin" /> : <Plus aria-hidden="true" />}
        {pending ? "Adding ticket…" : clientRequest ? "Submit request" : "Add to backlog"}
      </Button>
    </form>
  );
}
