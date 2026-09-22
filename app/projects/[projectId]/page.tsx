import Link from "next/link";
import { ArrowLeft, CalendarDays, Github, Users } from "lucide-react";
import { notFound, redirect } from "next/navigation";
import { AppHeader } from "@/components/app-header";
import { ArchivedTicketList } from "@/components/projects/archived-ticket-list";
import { KanbanBoard } from "@/components/projects/kanban-board";
import { TicketComposer } from "@/components/projects/ticket-composer";
import { DeleteProjectButton } from "@/components/projects/delete-project-button";
import { ProjectAnalytics } from "@/components/projects/project-analytics";
import { ProjectAdminSettings } from "@/components/projects/project-admin-settings";
import type { ProjectMemberOption } from "@/components/projects/create-project-form";
import { Button } from "@/components/ui/button";
import { markdownToPlainText } from "@/components/ui/markdown-content";
import { requireUser } from "@/lib/auth/session";
import { isTicketPriority, isTicketStatus, isTicketType } from "@/lib/projects/validation";
import { createAdminClient } from "@/lib/supabase/admin";
import { isAppRole, ROLE_LABELS } from "@/lib/auth/roles";
import { formatSprintLabel, getSprintWindow } from "@/lib/projects/sprints";

export const instant = false;

const statusLabels = { active: "Active", on_hold: "On hold", completed: "Completed" } as const;
const riskLabels = { on_track: "On track", at_risk: "At risk", off_track: "Off track" } as const;
const statusClasses = { active: "bg-blue-400/15 text-blue-200", on_hold: "bg-white/10 text-white/60", completed: "bg-emerald-400/15 text-emerald-200" } as const;
const riskClasses = { on_track: "bg-emerald-400/15 text-emerald-200", at_risk: "bg-amber-400/15 text-amber-200", off_track: "bg-red-400/15 text-red-200" } as const;

export default async function ProjectBoardPage({ params, searchParams }: { params: Promise<{ projectId: string }>; searchParams: Promise<{ new?: string }> }) {
  const { projectId } = await params;
  const query = await searchParams;
  const { supabase, claims } = await requireUser();
  const userId = typeof claims.sub === "string" ? claims.sub : "";
  const [{ data: project }, { data: tickets }, { data: roleRecord }, { data: memberships }] = await Promise.all([
    supabase.from("projects").select("id, name, description, project_type, client_logo_url, repository_url, retainer_hours, hourly_rate, sprint_start_date, status, risk, rollover_enabled, rollover_cap_hours").eq("id", projectId).maybeSingle(),
    supabase.from("tickets").select("id, title, description, status, priority, ticket_type, estimated_hours, logged_hours, billable_amount, created_at, updated_at").eq("project_id", projectId).order("created_at", { ascending: false }),
    supabase.from("user_roles").select("role").eq("user_id", userId).maybeSingle(),
    supabase.from("project_members").select("user_id").eq("project_id", projectId),
  ]);

  if (!project) notFound();
  const typedProject = project as typeof project & {
    project_type: "retainer" | "new_build";
    status: "active" | "on_hold" | "completed";
    risk: "on_track" | "at_risk" | "off_track";
  };
  const projectStatus = typedProject.status as "active" | "on_hold" | "completed";
  const projectRisk = typedProject.risk as "on_track" | "at_risk" | "off_track";
  const sprint = getSprintWindow(typedProject.sprint_start_date);
  const tomorrow = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
  const [{ data: sprintEntries }, { data: committedHoursResult }] = await Promise.all([
    supabase.rpc("get_project_daily_time_totals", {
      period_start: typedProject.sprint_start_date,
      period_end: tomorrow,
    }).eq("project_id", projectId),
    supabase.rpc("get_project_committed_hours", { target_project_id: projectId }),
  ]);
  const dailyTimeEntries = (sprintEntries ?? []) as Array<{ project_id: string; hours: number; work_date: string }>;
  const memberIds = (memberships ?? []).map((membership) => membership.user_id);
  const { data: memberProfiles } = memberIds.length
    ? await supabase.from("profiles").select("id, full_name").in("id", memberIds)
    : { data: [] };
  const ticketMembers = memberIds.map((memberId) => ({
    id: memberId,
    name: memberProfiles?.find((profile) => profile.id === memberId)?.full_name || `Member ${memberId.slice(0, 8)}`,
  }));
  const canManage = roleRecord?.role === "admin" || roleRecord?.role === "project_manager";
  const canMoveTickets = canManage || roleRecord?.role === "developer" || roleRecord?.role === "designer";
  const canCreateTicket = roleRecord?.role === "admin" || Boolean(memberships?.some((membership) => membership.user_id === userId));
  const validTickets = (tickets ?? []).filter(
    (ticket) => isTicketStatus(ticket.status) && isTicketPriority(ticket.priority) && isTicketType(ticket.ticket_type),
  ) as Array<{
    id: string;
    title: string;
    description: string | null;
    status: "backlog" | "pending_approval" | "in_progress" | "client_uat" | "ready_for_deploy" | "completed" | "archived";
    priority: "low" | "medium" | "high";
    ticket_type: "new_feature" | "feature_update" | "bug";
    estimated_hours: number;
    logged_hours: number;
    billable_amount: number;
    created_at: string;
    updated_at: string;
  }>;
  const archivedTicketIds = validTickets
    .filter((ticket) => ticket.status === "archived")
    .map((ticket) => ticket.id);
  const { data: archivedSubtasks } = archivedTicketIds.length
    ? await supabase
        .from("ticket_subtasks")
        .select("ticket_id, logged_hours")
        .in("ticket_id", archivedTicketIds)
    : { data: [] };
  const archivedSubtaskHours = new Map<string, number>();
  (archivedSubtasks ?? []).forEach((subtask) => {
    archivedSubtaskHours.set(
      subtask.ticket_id,
      (archivedSubtaskHours.get(subtask.ticket_id) ?? 0) +
        Number(subtask.logged_hours ?? 0),
    );
  });
  const loggedHours = Math.max(0, dailyTimeEntries.reduce((total, entry) => total + Number(entry.hours), 0));
  const estimatedHours = validTickets.reduce((total, ticket) => total + Number(ticket.estimated_hours || 0), 0);
  const sprintLoggedHours = Math.max(0, dailyTimeEntries.reduce((total, entry) => {
    const entryDate = entry.work_date;
    return entryDate >= sprint.start && entryDate < sprint.endExclusive ? total + Number(entry.hours) : total;
  }, 0));
  const committedHours = Math.max(0, Number(committedHoursResult ?? 0));
  const previousSprintStart = new Date(new Date(`${sprint.start}T00:00:00.000Z`).getTime() - 14 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
  const previousSprintHours = Math.max(0, dailyTimeEntries.reduce((total, entry) => {
    const entryDate = entry.work_date;
    return entryDate >= previousSprintStart && entryDate < sprint.start ? total + Number(entry.hours) : total;
  }, 0));
  const baseRetainerHours = project.retainer_hours === null ? null : Number(project.retainer_hours);
  const previousUnusedHours = baseRetainerHours === null ? 0 : Math.max(0, baseRetainerHours - previousSprintHours);
  const rolloverHours = typedProject.project_type === "retainer" && typedProject.rollover_enabled
    ? Math.min(previousUnusedHours, typedProject.rollover_cap_hours === null ? previousUnusedHours : Number(typedProject.rollover_cap_hours))
    : 0;
  const activeTickets = validTickets.filter((ticket) => ticket.status !== "completed" && ticket.status !== "archived").length;
  const completedTickets = validTickets.filter((ticket) => ticket.status === "completed").length;
  const isClient = roleRecord?.role === "client";
  if (isClient) redirect("/dashboard");
  const boardTickets = validTickets
    .filter((ticket) => ticket.status !== "archived")
    .map((ticket) => ({
      id: ticket.id,
      title: ticket.title,
      description: ticket.description,
      status: ticket.status,
      priority: ticket.priority,
      ticket_type: ticket.ticket_type,
      estimated_hours: ticket.estimated_hours,
      logged_hours: ticket.logged_hours,
      created_at: ticket.created_at,
    }));
  const archivedTickets = validTickets
    .filter((ticket) => ticket.status === "archived")
    .map((ticket) => ({
      id: ticket.id,
      title: ticket.title,
      archivedAt: ticket.updated_at,
      estimatedHours: Number(ticket.estimated_hours ?? 0),
      loggedHours:
        Number(ticket.logged_hours ?? 0) +
        (archivedSubtaskHours.get(ticket.id) ?? 0),
    }));
  const analyticsAudience = isClient
    ? "client" as const
    : canManage
      ? "manager" as const
      : "contributor" as const;
  const sprintLabel = formatSprintLabel(typedProject.sprint_start_date);

  let userOptions: ProjectMemberOption[] = [];
  let userDirectoryAvailable = false;
  if (canManage) {
    try {
      const adminClient = createAdminClient();
      const [{ data: authData }, { data: profiles }, { data: roles }] = await Promise.all([
        adminClient.auth.admin.listUsers({ page: 1, perPage: 1000 }),
        adminClient.from("profiles").select("id, full_name"),
        adminClient.from("user_roles").select("user_id, role"),
      ]);
      const names = new Map(profiles?.map((profile) => [profile.id, profile.full_name]));
      const roleById = new Map(roles?.map((role) => [role.user_id, role.role]));
      userDirectoryAvailable = true;
      userOptions = (authData?.users ?? []).map((user) => {
        const role = roleById.get(user.id);
        return {
          id: user.id,
          name: names.get(user.id) || (typeof user.user_metadata?.full_name === "string" ? user.user_metadata.full_name : "") || user.email?.split("@")[0] || "Unknown user",
          email: user.email ?? "No email",
          role: role && isAppRole(role) ? ROLE_LABELS[role] : "No role",
        };
      });
    } catch {
      userOptions = [];
    }
  }

  return (
    <main className="min-h-svh bg-[#f6f3ee] text-slate-950">
      <AppHeader />
      <div className="mx-auto max-w-[1500px] px-5 py-8 sm:px-8">
        <Button asChild className="-ml-3 text-slate-500" variant="ghost"><Link href="/projects"><ArrowLeft aria-hidden="true" />All projects</Link></Button>
        <div className="relative mt-4 overflow-hidden rounded-[2rem] bg-[#171717] px-6 py-8 text-white shadow-[0_24px_70px_rgba(23,23,23,.16)] sm:px-9 sm:py-11">
          <div className="absolute -right-20 -top-32 size-80 rounded-full bg-[#f00073] opacity-20 blur-[100px]" />
          <div className="flex flex-col justify-between gap-6 lg:flex-row lg:items-end">
          <div className="relative"><div className="flex items-center gap-3">{typedProject.client_logo_url && <span aria-label={`${project.name} logo`} className="size-12 rounded-xl border border-white/10 bg-white bg-contain bg-center bg-no-repeat" role="img" style={{ backgroundImage: `url(${typedProject.client_logo_url})` }} />}<div><p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-[#ff64ad]">{typedProject.project_type === "retainer" ? "Retainer" : "New build"} · {isClient ? "Client workspace" : "Agency delivery"}</p><div className="mt-2 flex flex-wrap gap-2"><span className={`rounded-full px-2.5 py-1 text-[11px] font-semibold ${statusClasses[projectStatus]}`}>{statusLabels[projectStatus]}</span><span className={`rounded-full px-2.5 py-1 text-[11px] font-semibold ${riskClasses[projectRisk]}`}>{riskLabels[projectRisk]}</span></div></div></div><h1 className="mt-5 text-5xl leading-none sm:text-6xl">{project.name}</h1>{project.description && <p className="mt-4 max-w-2xl text-sm leading-6 text-white/60">{markdownToPlainText(project.description)}</p>}<div className="mt-6 flex flex-wrap gap-4 text-xs text-white/40">{!isClient && <span className="flex items-center gap-1.5"><Users aria-hidden="true" className="size-3.5" />{memberships?.length ?? 0} members</span>}<span className="flex items-center gap-1.5"><CalendarDays aria-hidden="true" className="size-3.5" />{sprintLabel}</span>{typedProject.repository_url && !isClient && <a className="flex items-center gap-1.5 hover:text-white" href={typedProject.repository_url} rel="noreferrer" target="_blank"><Github aria-hidden="true" className="size-3.5" />Repository</a>}</div></div>
          <div className="flex items-center gap-4">
            <span className="text-sm text-white/45">{boardTickets.length} {isClient ? "requests" : "tickets"}</span>
            {canCreateTicket && <TicketComposer autoOpen={isClient && query.new === "request"} canPlan={canManage} clientRequest={isClient} members={ticketMembers} projectId={project.id} />}
            {roleRecord?.role === "admin" && <DeleteProjectButton projectId={project.id} projectName={project.name} />}
          </div>
          </div>
        </div>

        <ProjectAnalytics activeTickets={activeTickets} audience={analyticsAudience} committedHours={committedHours} completedTickets={completedTickets} estimatedHours={estimatedHours} loggedHours={loggedHours} projectType={typedProject.project_type} retainerHours={baseRetainerHours === null ? null : baseRetainerHours + rolloverHours} rolloverHours={rolloverHours} sprintLabel={sprintLabel} sprintLoggedHours={sprintLoggedHours} />

        {canManage && <ProjectAdminSettings canManageAccess={userDirectoryAvailable} hourlyRate={typedProject.hourly_rate === null ? null : Number(typedProject.hourly_rate)} projectId={project.id} projectType={typedProject.project_type} repositoryUrl={typedProject.repository_url} retainerHours={project.retainer_hours === null ? null : Number(project.retainer_hours)} risk={projectRisk} rolloverCapHours={typedProject.rollover_cap_hours === null ? null : Number(typedProject.rollover_cap_hours)} rolloverEnabled={Boolean(typedProject.rollover_enabled)} selectedMemberIds={(memberships ?? []).map((membership) => membership.user_id)} sprintStartDate={typedProject.sprint_start_date} status={projectStatus} users={userOptions} />}

        <div className="mt-10"><div className="mb-4"><p className="eyebrow">Delivery</p><h2 className="font-display mt-2 text-3xl leading-none">{isClient ? "Request status" : "Task board"}</h2>{isClient && <p className="mt-2 text-sm text-slate-500">Follow submitted requests from intake through delivery.</p>}</div><KanbanBoard canManage={canMoveTickets} clientView={isClient} projectId={project.id} tickets={boardTickets} /></div>
        <ArchivedTicketList projectId={project.id} tickets={archivedTickets} />
      </div>
    </main>
  );
}
