"use client";

import { useActionState, useEffect, useState } from "react";
import { Loader2, Plus } from "lucide-react";
import {
  createTicketAction,
  type ProjectActionState,
} from "@/app/projects/actions";
import { FormMessage } from "@/components/auth/form-message";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { TicketType } from "@/lib/projects/validation";

export type TicketMemberOption = { id: string; name: string };

const initialState: ProjectActionState = {};

export function CreateTicketForm({
  projectId,
  onCreated,
  clientRequest = false,
  members = [],
}: {
  projectId: string;
  onCreated?: () => void;
  clientRequest?: boolean;
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
        <Label htmlFor="ticket-title">Ticket title</Label>
        <Input autoFocus id="ticket-title" maxLength={140} minLength={2} name="title" placeholder={ticketType === "bug" ? "Checkout button fails on mobile" : "Add checkout validation"} required />
      </div>
      <div className="space-y-2">
        <Label htmlFor="ticket-type">Work type</Label>
        <select className="flex h-10 w-full rounded-md border border-input bg-transparent px-3 text-sm shadow-sm outline-none focus-visible:ring-1 focus-visible:ring-ring" id="ticket-type" name="ticketType" onChange={(event) => setTicketType(event.target.value as TicketType)} value={ticketType}>
          <option value="new_feature">New feature</option>
          <option value="feature_update">Update existing feature</option>
          <option value="bug">Bug</option>
        </select>
        <p className="text-xs text-slate-500">
          {ticketType === "bug" ? "Report where the issue happens and provide exact reproduction steps." : ticketType === "feature_update" ? "Explain the current behavior, the requested change, and how success will be verified." : "Describe the user need, desired outcome, and acceptance criteria."}
        </p>
      </div>
      <div className="space-y-2">
        <Label htmlFor="ticket-description">{ticketType === "bug" ? "Issue summary" : "Description and user need"}</Label>
        <textarea
          className="min-h-24 w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-sm outline-none placeholder:text-muted-foreground focus-visible:ring-1 focus-visible:ring-ring"
          id="ticket-description"
          maxLength={2000}
          name="description"
          placeholder={ticketType === "bug" ? "Summarize the issue, its impact, and when it started." : ticketType === "feature_update" ? "Describe the existing feature and what needs to change." : "As a user, I want… so that…"}
        />
      </div>
      {ticketType === "bug" ? (
        <div className="grid gap-4 rounded-xl border border-red-100 bg-red-50/50 p-4">
          <fieldset className="space-y-2"><legend className="text-sm font-medium">Affected platform</legend><div className="flex flex-wrap gap-4">{["desktop", "mobile", "tablet"].map((platform) => <label className="flex items-center gap-2 text-sm capitalize" key={platform}><input className="size-4 rounded border-slate-300" name="affectedPlatforms" type="checkbox" value={platform} />{platform}</label>)}</div></fieldset>
          <div className="space-y-2"><Label htmlFor="ticket-reproduction">Steps to reproduce</Label><textarea className="min-h-28 w-full rounded-md border border-input bg-white px-3 py-2 text-sm shadow-sm outline-none focus-visible:ring-1 focus-visible:ring-ring" id="ticket-reproduction" maxLength={5000} name="reproductionSteps" placeholder={"1. Open…\n2. Select…\n3. Observe…"} required /></div>
          <div className="grid gap-4 sm:grid-cols-2"><div className="space-y-2"><Label htmlFor="ticket-expected">Expected behavior</Label><textarea className="min-h-24 w-full rounded-md border border-input bg-white px-3 py-2 text-sm shadow-sm outline-none focus-visible:ring-1 focus-visible:ring-ring" id="ticket-expected" maxLength={3000} name="expectedBehavior" required /></div><div className="space-y-2"><Label htmlFor="ticket-actual">Actual behavior</Label><textarea className="min-h-24 w-full rounded-md border border-input bg-white px-3 py-2 text-sm shadow-sm outline-none focus-visible:ring-1 focus-visible:ring-ring" id="ticket-actual" maxLength={3000} name="actualBehavior" required /></div></div>
        </div>
      ) : (
        <div className="space-y-2"><Label htmlFor="ticket-acceptance">Acceptance criteria</Label><textarea className="min-h-28 w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-sm outline-none focus-visible:ring-1 focus-visible:ring-ring" id="ticket-acceptance" maxLength={5000} name="acceptanceCriteria" placeholder={"- Given… when… then…\n- The user can…\n- The feature handles…"} required /></div>
      )}
      <div className="space-y-2">
        <Label htmlFor="ticket-priority">Priority</Label>
        <select className="flex h-10 w-full rounded-md border border-input bg-transparent px-3 text-sm shadow-sm outline-none focus-visible:ring-1 focus-visible:ring-ring" defaultValue="medium" id="ticket-priority" name="priority">
          <option value="low">Low</option>
          <option value="medium">Medium</option>
          <option value="high">High</option>
        </select>
      </div>
      <fieldset className="grid gap-4 rounded-xl border border-stone-200 p-4 sm:grid-cols-2">
        <legend className="px-1 text-sm font-medium">References</legend>
        <div className="space-y-2"><Label htmlFor="ticket-preview-url">Preview or affected page</Label><Input id="ticket-preview-url" maxLength={2000} name="previewUrl" placeholder="https://…" type="url" /></div>
        <div className="space-y-2"><Label htmlFor="ticket-design-url">Design link</Label><Input id="ticket-design-url" maxLength={2000} name="designUrl" placeholder="https://figma.com/…" type="url" /></div>
        {!clientRequest && <div className="space-y-2 sm:col-span-2"><Label htmlFor="ticket-repository-url">GitHub repository</Label><Input id="ticket-repository-url" maxLength={2000} name="repositoryUrl" placeholder="https://github.com/…" type="url" /></div>}
      </fieldset>
      {!clientRequest && (
        <fieldset className="grid gap-4 rounded-xl border border-stone-200 p-4 sm:grid-cols-3">
          <legend className="px-1 text-sm font-medium">Planning</legend>
          <div className="space-y-2"><Label htmlFor="ticket-assignee">Assignee</Label><select className="flex h-10 w-full rounded-md border border-input bg-transparent px-3 text-sm shadow-sm outline-none focus-visible:ring-1 focus-visible:ring-ring" defaultValue="" id="ticket-assignee" name="assigneeId"><option value="">Unassigned</option>{members.map((member) => <option key={member.id} value={member.id}>{member.name}</option>)}</select></div>
          <div className="space-y-2"><Label htmlFor="ticket-due-date">Due date</Label><Input id="ticket-due-date" name="dueDate" type="date" /></div>
          <div className="space-y-2"><Label htmlFor="ticket-estimated-hours">Estimated hours</Label><Input id="ticket-estimated-hours" min="0" name="estimatedHours" placeholder="2.5" step="0.25" type="number" /></div>
          <div className="space-y-2 sm:col-span-3"><Label htmlFor="ticket-dev-notes">Development notes</Label><textarea className="min-h-24 w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-sm outline-none focus-visible:ring-1 focus-visible:ring-ring" id="ticket-dev-notes" maxLength={10000} name="devNotes" placeholder="Implementation considerations, dependencies, technical constraints…" /></div>
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
