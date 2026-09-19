import Link from "next/link";
import { ArrowLeft, Bug, CalendarDays, ExternalLink, GitBranch, Link2, MessageSquare, Palette, RefreshCw, Sparkles, UserRound } from "lucide-react";
import { notFound } from "next/navigation";
import { AppHeader } from "@/components/app-header";
import { CommentForm } from "@/components/projects/comment-form";
import { SubtaskSection } from "@/components/projects/subtask-section";
import { TicketDetailsForm } from "@/components/projects/ticket-details-form";
import { TicketUsageForm } from "@/components/projects/ticket-usage-form";
import { Button } from "@/components/ui/button";
import { requireUser } from "@/lib/auth/session";
import { isTicketPriority, isTicketStatus, isTicketType } from "@/lib/projects/validation";

export const instant = false;

const priorityClasses = { low: "bg-stone-100 text-slate-600", medium: "bg-amber-50 text-amber-700", high: "bg-red-50 text-red-700" };
const statusLabels = { backlog: "Backlog", in_progress: "In progress", completed: "Completed", archived: "Archived" };
const typeDetails = {
  new_feature: { label: "New feature", icon: Sparkles, classes: "bg-pink-50 text-pink-700" },
  feature_update: { label: "Feature update", icon: RefreshCw, classes: "bg-blue-50 text-blue-700" },
  bug: { label: "Bug", icon: Bug, classes: "bg-red-50 text-red-700" },
};

function formatDateTime(value: string) {
  return new Intl.DateTimeFormat("en", { dateStyle: "medium", timeStyle: "short", timeZone: "UTC" }).format(new Date(value));
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat("en", { dateStyle: "medium", timeZone: "UTC" }).format(new Date(`${value}T00:00:00Z`));
}

function getInitials(name: string) {
  return name.split(" ").filter(Boolean).slice(0, 2).map((part) => part[0]?.toUpperCase()).join("");
}

function safeUrl(value: string | null) {
  if (!value) return null;
  try {
    const parsed = new URL(value);
    return parsed.protocol === "https:" || parsed.protocol === "http:" ? value : null;
  } catch {
    return null;
  }
}

function renderCommentContent(content: string, memberNames: string[]) {
  if (!memberNames.length) return content;
  const escapedNames = memberNames
    .filter(Boolean)
    .sort((left, right) => right.length - left.length)
    .map((name) => name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"));
  if (!escapedNames.length) return content;
  const mentionPattern = new RegExp(`(@(?:${escapedNames.join("|")}))`, "g");
  return content.split(mentionPattern).map((part, index) => part.startsWith("@")
    ? <span className="rounded bg-pink-50 px-1 font-medium text-pink-700" key={`${part}-${index}`}>{part}</span>
    : part);
}

export default async function TicketPage({ params }: { params: Promise<{ projectId: string; ticketId: string }> }) {
  const { projectId, ticketId } = await params;
  const { supabase, claims } = await requireUser();
  const userId = typeof claims.sub === "string" ? claims.sub : "";
  const [{ data: project }, { data: ticket }, { data: comments }, { data: roleRecord }, { data: subtasks }, { data: memberships }] = await Promise.all([
    supabase.from("projects").select("id, name, currency").eq("id", projectId).maybeSingle(),
    supabase.from("tickets").select("id, project_id, title, description, status, priority, ticket_type, acceptance_criteria, reproduction_steps, expected_behavior, actual_behavior, affected_platforms, preview_url, repository_url, design_url, dev_notes, assignee_id, due_date, estimated_hours, logged_hours, billable_amount, created_by, created_at, updated_at").eq("id", ticketId).eq("project_id", projectId).maybeSingle(),
    supabase.from("ticket_comments").select("id, user_id, content, created_at, is_internal").eq("ticket_id", ticketId).order("created_at", { ascending: true }),
    supabase.from("user_roles").select("role").eq("user_id", userId).maybeSingle(),
    supabase.from("ticket_subtasks").select("id, title, description, is_completed, due_date, assignee_id, estimated_hours, logged_hours, created_at").eq("ticket_id", ticketId).order("created_at", { ascending: true }),
    supabase.from("project_members").select("user_id").eq("project_id", projectId),
  ]);

  if (!project || !ticket || !isTicketStatus(ticket.status) || !isTicketPriority(ticket.priority) || !isTicketType(ticket.ticket_type)) notFound();

  const profileIds = [...new Set([...(memberships ?? []).map((membership) => membership.user_id), ...(comments ?? []).map((comment) => comment.user_id), ...(subtasks ?? []).map((subtask) => subtask.assignee_id), ticket.created_by, ticket.assignee_id].filter((id): id is string => typeof id === "string"))];
  const { data: profiles } = profileIds.length ? await supabase.from("profiles").select("id, full_name").in("id", profileIds) : { data: [] };
  const profileById = new Map(profiles?.map((profile) => [profile.id, profile.full_name]));
  const members = (memberships ?? []).map((membership) => ({ id: membership.user_id, name: profileById.get(membership.user_id) || `Member ${membership.user_id.slice(0, 8)}` }));
  const canManage = roleRecord?.role === "admin" || roleRecord?.role === "project_manager";
  const canWork = canManage || roleRecord?.role === "developer" || roleRecord?.role === "designer";
  const isClient = roleRecord?.role === "client";
  const typeDetail = typeDetails[ticket.ticket_type];
  const TypeIcon = typeDetail.icon;
  const ticketKey = `${project.name.split(/\s+/).map((word: string) => word[0]).join("").slice(0, 4).toUpperCase() || "TASK"}-${ticket.id.slice(0, 6).toUpperCase()}`;
  const assigneeName = ticket.assignee_id ? profileById.get(ticket.assignee_id) || "Project member" : "Unassigned";
  const reporterName = ticket.created_by ? profileById.get(ticket.created_by) || "Project member" : "Deleted user";
  const memberNames = members.map((member) => member.name);
  const references = [
    { label: "Preview", url: safeUrl(ticket.preview_url), icon: Link2 },
    ...(!isClient ? [{ label: "GitHub", url: safeUrl(ticket.repository_url), icon: GitBranch }] : []),
    { label: "Design", url: safeUrl(ticket.design_url), icon: Palette },
  ].filter((reference) => reference.url);

  return (
    <main className="min-h-svh bg-[#f6f3ee] text-slate-950">
      <AppHeader />
      <div className="mx-auto max-w-7xl px-5 py-8 sm:px-8 sm:py-10">
        <Button asChild className="-ml-3 text-slate-500" variant="ghost"><Link href={`/projects/${projectId}`}><ArrowLeft aria-hidden="true" />Back to {project.name}</Link></Button>
        <header className="relative mt-4 overflow-hidden rounded-[2rem] bg-[#171717] px-6 py-8 text-white shadow-[0_24px_70px_rgba(23,23,23,.14)] sm:px-9 sm:py-10">
          <div className="absolute -right-14 -top-20 size-60 rounded-full bg-[#f00073] opacity-20 blur-[80px]" />
          <div className="relative flex flex-wrap items-center gap-2 text-xs"><span className={`inline-flex items-center gap-1.5 rounded-md px-2.5 py-1 font-medium ${typeDetail.classes}`}><TypeIcon aria-hidden="true" className="size-3.5" />{typeDetail.label}</span><span className="font-mono font-medium text-white/55">{ticketKey}</span><span className="text-white/20">/</span><span className="text-white/45">{project.name}</span></div>
          <h1 className="relative mt-5 max-w-4xl text-4xl leading-[1.05] sm:text-5xl">{ticket.title}</h1>
          <p className="relative mt-4 text-xs text-white/35">Created {formatDateTime(ticket.created_at)} UTC · Updated {formatDateTime(ticket.updated_at)} UTC</p>
        </header>

        <div className="mt-8 grid gap-8 lg:grid-cols-[minmax(0,1fr)_320px]">
          <div className="grid min-w-0 content-start gap-7">
            <article className="overflow-hidden rounded-2xl border border-stone-200 bg-white shadow-sm">
              <div className="p-5 sm:p-7"><h2 className="text-sm font-semibold">Description</h2><p className="mt-3 whitespace-pre-wrap text-sm leading-6 text-slate-700">{ticket.description || "No description provided."}</p></div>
              {ticket.ticket_type === "bug" ? (
                <div className="grid gap-6 border-t border-stone-100 p-5 sm:p-7">
                  <div><h2 className="text-sm font-semibold">Affected platforms</h2><div className="mt-3 flex flex-wrap gap-2">{ticket.affected_platforms.map((platform: string) => <span className="rounded-md bg-red-50 px-2.5 py-1 text-xs font-medium capitalize text-red-700" key={platform}>{platform}</span>)}</div></div>
                  <div><h2 className="text-sm font-semibold">Steps to reproduce</h2><p className="mt-3 whitespace-pre-wrap text-sm leading-6 text-slate-700">{ticket.reproduction_steps}</p></div>
                  <div className="grid gap-5 sm:grid-cols-2"><div className="rounded-xl bg-emerald-50/70 p-4"><h2 className="text-sm font-semibold text-emerald-900">Expected behavior</h2><p className="mt-2 whitespace-pre-wrap text-sm leading-6 text-emerald-950/80">{ticket.expected_behavior}</p></div><div className="rounded-xl bg-red-50/70 p-4"><h2 className="text-sm font-semibold text-red-900">Actual behavior</h2><p className="mt-2 whitespace-pre-wrap text-sm leading-6 text-red-950/80">{ticket.actual_behavior}</p></div></div>
                </div>
              ) : <div className="border-t border-stone-100 p-5 sm:p-7"><h2 className="text-sm font-semibold">Acceptance criteria</h2><p className="mt-3 whitespace-pre-wrap text-sm leading-6 text-slate-700">{ticket.acceptance_criteria || "No acceptance criteria provided."}</p></div>}
              {((!isClient && ticket.dev_notes) || references.length > 0) && <div className="grid gap-6 border-t border-stone-100 bg-slate-50/60 p-5 sm:p-7">{references.length > 0 && <div><h2 className="text-sm font-semibold">References</h2><div className="mt-3 flex flex-wrap gap-2">{references.map((reference) => <a className="inline-flex items-center gap-2 rounded-lg border border-stone-200 bg-white px-3 py-2 text-sm font-medium text-pink-600 hover:border-pink-200" href={reference.url ?? undefined} key={reference.label} rel="noreferrer" target="_blank"><reference.icon aria-hidden="true" className="size-4" />{reference.label}<ExternalLink aria-hidden="true" className="size-3" /></a>)}</div></div>}{!isClient && ticket.dev_notes && <div><h2 className="text-sm font-semibold">Development notes</h2><p className="mt-3 whitespace-pre-wrap rounded-xl bg-slate-900 p-4 font-mono text-xs leading-6 text-slate-200">{ticket.dev_notes}</p></div>}</div>}
            </article>

            {canManage && <TicketDetailsForm members={members} projectId={projectId} ticket={ticket} ticketId={ticketId} />}
            <SubtaskSection canWork={canWork} clientView={isClient} members={members} projectId={projectId} subtasks={subtasks ?? []} ticketId={ticketId} />

            <section aria-labelledby="comments-heading" className="overflow-hidden rounded-2xl border border-stone-200 bg-white shadow-sm">
              <div className="flex items-center justify-between border-b border-stone-100 px-5 py-5 sm:px-7"><div className="flex items-center gap-3"><span className="grid size-9 place-items-center rounded-xl bg-pink-50 text-pink-600"><MessageSquare aria-hidden="true" className="size-4" /></span><h2 className="text-lg font-semibold" id="comments-heading">{isClient ? "Project conversation" : "Activity and comments"}</h2></div><span className="text-sm text-slate-500">{comments?.length ?? 0}</span></div>
              <div className="divide-y divide-slate-100">{comments?.length ? comments.map((comment) => { const authorName = comment.user_id ? profileById.get(comment.user_id) || "Team member" : "Deleted user"; return <article className={`flex gap-3 px-5 py-5 sm:gap-4 sm:px-7 ${comment.is_internal ? "bg-amber-50/70" : ""}`} key={comment.id}><span className={`grid size-9 shrink-0 place-items-center rounded-full text-xs font-semibold ${comment.is_internal ? "bg-amber-100 text-amber-800" : "bg-pink-50 text-pink-700"}`}>{getInitials(authorName) || "?"}</span><div className="min-w-0 flex-1"><div className="flex flex-col gap-0.5 sm:flex-row sm:items-baseline sm:justify-between sm:gap-4"><div className="flex flex-wrap items-center gap-2"><h3 className="text-sm font-semibold">{authorName}</h3>{comment.is_internal && <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-amber-800">Internal note</span>}</div><time className="text-xs text-slate-400" dateTime={comment.created_at}>{formatDateTime(comment.created_at)} UTC</time></div><p className="mt-2 whitespace-pre-wrap break-words text-sm leading-6 text-slate-700">{renderCommentContent(comment.content, memberNames)}</p></div></article>; }) : <div className="px-5 py-10 text-center text-sm text-slate-500 sm:px-7">No comments yet. Start the conversation below.</div>}</div>
              <div className="border-t border-stone-100 bg-slate-50/60 p-5 sm:p-7"><CommentForm canCreateInternalNote={canWork} members={members} projectId={projectId} ticketId={ticketId} /></div>
            </section>
          </div>

          <aside className="grid content-start gap-5 lg:sticky lg:top-6 lg:self-start">
            <section className="rounded-2xl border border-stone-200 bg-white p-5 shadow-sm" aria-label="Ticket details">
              <div className="flex flex-wrap items-center gap-2"><span className="rounded-full bg-pink-50 px-2.5 py-1 text-xs font-medium text-pink-700">{statusLabels[ticket.status]}</span><span className={`rounded-full px-2.5 py-1 text-xs font-medium capitalize ${priorityClasses[ticket.priority]}`}>{ticket.priority} priority</span></div>
              <dl className="mt-5 grid gap-5 text-sm"><div><dt className="flex items-center gap-2 text-xs font-medium uppercase tracking-wide text-slate-400"><UserRound aria-hidden="true" className="size-3.5" />Assignee</dt><dd className="mt-2 font-medium">{assigneeName}</dd></div><div><dt className="flex items-center gap-2 text-xs font-medium uppercase tracking-wide text-slate-400"><UserRound aria-hidden="true" className="size-3.5" />Reporter</dt><dd className="mt-2 font-medium">{reporterName}</dd></div><div><dt className="flex items-center gap-2 text-xs font-medium uppercase tracking-wide text-slate-400"><CalendarDays aria-hidden="true" className="size-3.5" />Due date</dt><dd className="mt-2 font-medium">{ticket.due_date ? formatDate(ticket.due_date) : "Not set"}</dd></div></dl>
              <dl className={`mt-6 grid gap-2 border-t border-stone-100 pt-5 text-center ${isClient ? "grid-cols-2" : "grid-cols-3"}`}><div><dt className="text-[10px] uppercase tracking-wide text-slate-400">Estimate</dt><dd className="mt-1 text-sm font-semibold">{Number(ticket.estimated_hours).toFixed(1)}h</dd></div><div><dt className="text-[10px] uppercase tracking-wide text-slate-400">{isClient ? "Retainer used" : "Logged"}</dt><dd className="mt-1 text-sm font-semibold">{Number(ticket.logged_hours).toFixed(1)}h</dd></div>{!isClient && <div><dt className="text-[10px] uppercase tracking-wide text-slate-400">Billable</dt><dd className="mt-1 text-sm font-semibold">{project.currency} {Number(ticket.billable_amount).toLocaleString(undefined, { maximumFractionDigits: 0 })}</dd></div>}</dl>
            </section>
            {canManage && <section className="rounded-2xl border border-stone-200 bg-white p-5 shadow-sm" aria-label="Ticket usage management"><TicketUsageForm billableAmount={Number(ticket.billable_amount)} currency={project.currency} estimatedHours={Number(ticket.estimated_hours)} loggedHours={Number(ticket.logged_hours)} projectId={projectId} ticketId={ticketId} /></section>}
          </aside>
        </div>
      </div>
    </main>
  );
}
