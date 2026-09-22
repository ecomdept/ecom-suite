"use client";

import { useActionState } from "react";
import {
  CheckCircle2,
  Clock3,
  Loader2,
  RotateCcw,
  Send,
  TrendingUp,
} from "lucide-react";
import {
  requestEstimateIncreaseAction,
  respondToEstimateAction,
  respondToUatAction,
  submitTicketForApprovalAction,
  type ProjectActionState,
} from "@/app/projects/actions";
import { FormMessage } from "@/components/auth/form-message";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { RichTextEditor } from "@/components/ui/rich-text-editor";

const initialState: ProjectActionState = {};

type TicketWorkflowPanelProps = {
  projectId: string;
  ticketId: string;
  isClient: boolean;
  canManage: boolean;
  approvalStatus: string;
  workCategory: string | null;
  estimatedHours: number;
  previousEstimatedHours: number | null;
};

export function TicketWorkflowPanel({
  projectId,
  ticketId,
  isClient,
  canManage,
  approvalStatus,
  workCategory,
  estimatedHours,
  previousEstimatedHours,
}: TicketWorkflowPanelProps) {
  const [state, action, pending] = useActionState(
    submitTicketForApprovalAction,
    initialState,
  );
  const [increaseState, increaseAction, increasePending] = useActionState(
    requestEstimateIncreaseAction,
    initialState,
  );
  const [estimateState, estimateAction, estimatePending] = useActionState(
    respondToEstimateAction,
    initialState,
  );
  const [uatState, uatAction, uatPending] = useActionState(
    respondToUatAction,
    initialState,
  );
  const isIncreaseRequest = previousEstimatedHours !== null;

  if (isClient && approvalStatus === "pending") {
    return (
      <section className="rounded-2xl border border-amber-200 bg-amber-50 p-5 shadow-sm">
        <p className="text-xs font-semibold uppercase tracking-wider text-amber-700">
          {isIncreaseRequest ? "Revised estimate approval" : "Estimate approval"}
        </p>
        <h2 className="mt-2 text-lg font-semibold">
          Approve {estimatedHours.toFixed(1)} hours?
        </h2>
        <p className="mt-2 text-sm leading-6 text-amber-900/70">
          {isIncreaseRequest
            ? `The original approved estimate was ${previousEstimatedHours.toFixed(1)} hours. Approving makes ${estimatedHours.toFixed(1)} hours the new final estimate.`
            : "Approval moves this request into delivery. Ask for changes if the scope or estimate needs another pass."}
        </p>
        <div className="mt-4 flex flex-wrap gap-2">
          <form action={estimateAction}>
            <input name="projectId" type="hidden" value={projectId} />
            <input name="ticketId" type="hidden" value={ticketId} />
            <input name="decision" type="hidden" value="approve" />
            <input
              name="estimateKind"
              type="hidden"
              value={isIncreaseRequest ? "increase" : "initial"}
            />
            <Button
              className="bg-emerald-600 hover:bg-emerald-500"
              disabled={estimatePending}
              type="submit"
            >
              {estimatePending ? (
                <Loader2 className="animate-spin" />
              ) : (
                <CheckCircle2 />
              )}
              Approve estimate
            </Button>
          </form>
          <form action={estimateAction}>
            <input name="projectId" type="hidden" value={projectId} />
            <input name="ticketId" type="hidden" value={ticketId} />
            <input name="decision" type="hidden" value="changes" />
            <input
              name="estimateKind"
              type="hidden"
              value={isIncreaseRequest ? "increase" : "initial"}
            />
            <Button disabled={estimatePending} type="submit" variant="outline">
              <RotateCcw />
              {isIncreaseRequest ? "Decline increase" : "Request changes"}
            </Button>
          </form>
        </div>
        <FormMessage error={estimateState.error} success={estimateState.success} />
      </section>
    );
  }

  if (isClient && approvalStatus === "uat_pending") {
    return (
      <section className="rounded-2xl border border-fuchsia-200 bg-fuchsia-50 p-5 shadow-sm">
        <p className="text-xs font-semibold uppercase tracking-wider text-fuchsia-700">
          Ready for UAT
        </p>
        <h2 className="mt-2 text-lg font-semibold">
          Please review the delivered work
        </h2>
        <p className="mt-2 text-sm leading-6 text-fuchsia-900/70">
          Accepting sends the ticket to your PM for deployment. If it needs
          changes, provide feedback that the full project team can follow as a
          new subtask.
        </p>
        <div className="mt-4 flex flex-wrap items-start gap-2">
          <form action={uatAction}>
            <input name="projectId" type="hidden" value={projectId} />
            <input name="ticketId" type="hidden" value={ticketId} />
            <input name="decision" type="hidden" value="approve" />
            <Button
              className="bg-emerald-600 hover:bg-emerald-500"
              disabled={uatPending}
              type="submit"
            >
              {uatPending ? (
                <Loader2 className="animate-spin" />
              ) : (
                <CheckCircle2 />
              )}
              Accept UAT
            </Button>
          </form>
          <details className="w-full rounded-xl border border-fuchsia-200 bg-white p-4 sm:max-w-xl">
            <summary className="cursor-pointer list-none text-sm font-medium text-fuchsia-800 marker:hidden">
              <span className="inline-flex items-center gap-2">
                <RotateCcw className="size-4" />
                Needs changes
              </span>
            </summary>
            <form action={uatAction} className="mt-4 grid gap-3">
              <input name="projectId" type="hidden" value={projectId} />
              <input name="ticketId" type="hidden" value={ticketId} />
              <input name="decision" type="hidden" value="changes" />
              <div className="space-y-2">
                <Label htmlFor={`uat-feedback-${ticketId}`}>
                  What needs to change?
                </Label>
                <RichTextEditor
                  id={`uat-feedback-${ticketId}`}
                  maxLength={2000}
                  minHeight="min-h-24"
                  name="feedback"
                  placeholder="Describe what did not meet the request and what should be adjusted…"
                  required
                />
              </div>
              <FormMessage error={uatState.error} success={uatState.success} />
              <Button disabled={uatPending} type="submit" variant="outline">
                {uatPending ? (
                  <Loader2 className="animate-spin" />
                ) : (
                  <RotateCcw />
                )}
                Send back to delivery
              </Button>
            </form>
          </details>
        </div>
      </section>
    );
  }

  if (!canManage) return null;

  if (approvalStatus === "pending" && isIncreaseRequest) {
    return (
      <section className="rounded-2xl border border-amber-200 bg-amber-50 p-5 shadow-sm">
        <div className="flex items-start gap-3">
          <Clock3 className="mt-0.5 size-5 text-amber-700" />
          <div>
            <p className="text-xs font-semibold uppercase tracking-wider text-amber-700">
              Awaiting client approval
            </p>
            <h2 className="mt-2 text-lg font-semibold">
              Revised estimate: {estimatedHours.toFixed(1)} hours
            </h2>
            <p className="mt-1 text-sm text-amber-900/70">
              The current approved estimate remains {previousEstimatedHours.toFixed(1)}
              hours until the client approves this increase.
            </p>
          </div>
        </div>
      </section>
    );
  }

  if (approvalStatus === "approved") {
    const minimumEstimate = Math.round((estimatedHours + 0.25) * 100) / 100;

    return (
      <section className="rounded-2xl border border-stone-200 bg-white p-5 shadow-sm">
        <p className="text-xs font-semibold uppercase tracking-wider text-pink-600">
          Estimate management
        </p>
        <h2 className="mt-2 text-lg font-semibold">Request an increase</h2>
        <p className="mt-1 text-sm leading-6 text-slate-500">
          The client approved {estimatedHours.toFixed(1)} hours. Enter the new
          total estimate—not the additional hours—to send it for approval.
        </p>
        <form action={increaseAction} className="mt-4 grid gap-4">
          <input name="projectId" type="hidden" value={projectId} />
          <input name="ticketId" type="hidden" value={ticketId} />
          <div className="space-y-2">
            <Label htmlFor={`increase-estimate-${ticketId}`}>
              Revised total estimate (hours)
            </Label>
            <Input
              id={`increase-estimate-${ticketId}`}
              min={minimumEstimate}
              name="estimatedHours"
              placeholder={minimumEstimate.toFixed(2)}
              required
              step="0.25"
              type="number"
            />
          </div>
          <FormMessage
            error={increaseState.error}
            success={increaseState.success}
          />
          <Button
            className="justify-self-start"
            disabled={increasePending}
            type="submit"
            variant="outline"
          >
            {increasePending ? (
              <Loader2 className="animate-spin" />
            ) : (
              <TrendingUp />
            )}
            {increasePending ? "Sending…" : "Request increase"}
          </Button>
        </form>
      </section>
    );
  }

  if (["uat_pending", "uat_approved"].includes(approvalStatus)) return null;

  return (
    <section className="rounded-2xl border border-stone-200 bg-white p-5 shadow-sm">
      <p className="text-xs font-semibold uppercase tracking-wider text-pink-600">
        PM workflow
      </p>
      <h2 className="mt-2 text-lg font-semibold">Prepare client approval</h2>
      <p className="mt-1 text-sm text-slate-500">
        Polish the ticket first, categorize the work, then send the estimate.
        Development work creates private Dev, QA, and Deploy steps.
      </p>
      <form action={action} className="mt-4 grid gap-4">
        <input name="projectId" type="hidden" value={projectId} />
        <input name="ticketId" type="hidden" value={ticketId} />
        <div className="space-y-2">
          <Label htmlFor="work-category">Work category</Label>
          <select
            className="flex h-10 w-full rounded-md border border-input bg-white px-3 text-sm"
            defaultValue={workCategory ?? "dev_work"}
            id="work-category"
            name="workCategory"
          >
            <option value="dev_work">Development work</option>
            <option value="admin_work">Admin work</option>
          </select>
        </div>
        <div className="space-y-2">
          <Label htmlFor="approval-estimate">Estimate for client (hours)</Label>
          <Input
            defaultValue={estimatedHours || ""}
            id="approval-estimate"
            min="0.25"
            name="estimatedHours"
            required
            step="0.25"
            type="number"
          />
        </div>
        <FormMessage error={state.error} success={state.success} />
        <Button
          className="justify-self-start bg-pink-600 hover:bg-pink-500"
          disabled={pending}
          type="submit"
        >
          {pending ? <Loader2 className="animate-spin" /> : <Send />}
          {pending
            ? "Sending…"
            : approvalStatus === "pending"
              ? "Resend approval"
              : "Send for approval"}
        </Button>
      </form>
    </section>
  );
}
