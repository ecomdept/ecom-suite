import Link from "next/link";
import { ArrowLeft, CalendarDays, Users } from "lucide-react";
import { notFound } from "next/navigation";
import { AppHeader } from "@/components/app-header";
import { KanbanBoard } from "@/components/projects/kanban-board";
import { TicketComposer } from "@/components/projects/ticket-composer";
import { DeleteProjectButton } from "@/components/projects/delete-project-button";
import { ProjectAnalytics } from "@/components/projects/project-analytics";
import { ProjectAdminSettings } from "@/components/projects/project-admin-settings";
import type { ProjectMemberOption } from "@/components/projects/create-project-form";
import { Button } from "@/components/ui/button";
import { requireUser } from "@/lib/auth/session";
import { isTicketPriority, isTicketStatus, isTicketType } from "@/lib/projects/validation";
import { createAdminClient } from "@/lib/supabase/admin";
import { isAppRole, ROLE_LABELS } from "@/lib/auth/roles";

export const instant = false;

export default async function ProjectBoardPage({ params }: { params: Promise<{ projectId: string }> }) {
  const { projectId } = await params;
  const { supabase, claims } = await requireUser();
  const userId = typeof claims.sub === "string" ? claims.sub : "";
  const [{ data: project }, { data: tickets }, { data: roleRecord }, { data: memberships }] = await Promise.all([
    supabase.from("projects").select("id, name, description, retainer_hours, budget_amount, currency, retainer_period_start, retainer_period_end").eq("id", projectId).maybeSingle(),
    supabase.from("tickets").select("id, title, description, status, priority, ticket_type, estimated_hours, logged_hours, billable_amount, created_at").eq("project_id", projectId).order("created_at", { ascending: false }),
    supabase.from("user_roles").select("role").eq("user_id", userId).maybeSingle(),
    supabase.from("project_members").select("user_id").eq("project_id", projectId),
  ]);

  if (!project) notFound();
  const memberIds = (memberships ?? []).map((membership) => membership.user_id);
  const { data: memberProfiles } = memberIds.length
    ? await supabase.from("profiles").select("id, full_name").in("id", memberIds)
    : { data: [] };
  const ticketMembers = memberIds.map((memberId) => ({
    id: memberId,
    name: memberProfiles?.find((profile) => profile.id === memberId)?.full_name || `Member ${memberId.slice(0, 8)}`,
  }));
  const canManage = roleRecord?.role === "admin" || roleRecord?.role === "project_manager";
  const canCreateTicket = roleRecord?.role === "admin" || Boolean(memberships?.some((membership) => membership.user_id === userId));
  const validTickets = (tickets ?? []).filter(
    (ticket) => isTicketStatus(ticket.status) && isTicketPriority(ticket.priority) && isTicketType(ticket.ticket_type),
  ) as Array<{
    id: string;
    title: string;
    description: string | null;
    status: "backlog" | "in_progress" | "completed" | "archived";
    priority: "low" | "medium" | "high";
    ticket_type: "new_feature" | "feature_update" | "bug";
    estimated_hours: number;
    logged_hours: number;
    billable_amount: number;
    created_at: string;
  }>;
  const loggedHours = validTickets.reduce((total, ticket) => total + Number(ticket.logged_hours || 0), 0);
  const estimatedHours = validTickets.reduce((total, ticket) => total + Number(ticket.estimated_hours || 0), 0);
  const billableAmount = validTickets.reduce((total, ticket) => total + Number(ticket.billable_amount || 0), 0);
  const activeTickets = validTickets.filter((ticket) => ticket.status === "backlog" || ticket.status === "in_progress").length;
  const completedTickets = validTickets.filter((ticket) => ticket.status === "completed").length;
  const isClient = roleRecord?.role === "client";
  const boardTickets = validTickets
    .filter((ticket) => !isClient || ticket.status !== "archived")
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
  const analyticsAudience = isClient
    ? "client" as const
    : canManage
      ? "manager" as const
      : "contributor" as const;
  const formatPeriodDate = (value: string) => new Intl.DateTimeFormat("en", { month: "short", day: "numeric", year: "numeric", timeZone: "UTC" }).format(new Date(`${value}T00:00:00Z`));
  const periodLabel = project.retainer_period_start && project.retainer_period_end
    ? `${formatPeriodDate(project.retainer_period_start)} – ${formatPeriodDate(project.retainer_period_end)}`
    : undefined;

  let userOptions: ProjectMemberOption[] = [];
  if (roleRecord?.role === "admin") {
    try {
      const adminClient = createAdminClient();
      const [{ data: authData }, { data: profiles }, { data: roles }] = await Promise.all([
        adminClient.auth.admin.listUsers({ page: 1, perPage: 1000 }),
        adminClient.from("profiles").select("id, full_name"),
        adminClient.from("user_roles").select("user_id, role"),
      ]);
      const names = new Map(profiles?.map((profile) => [profile.id, profile.full_name]));
      const roleById = new Map(roles?.map((role) => [role.user_id, role.role]));
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
          <div className="relative"><p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-[#ff64ad]">Client project portal</p><h1 className="mt-4 text-5xl leading-none sm:text-6xl">{project.name}</h1>{project.description && <p className="mt-4 max-w-2xl text-sm leading-6 text-white/60">{project.description}</p>}<div className="mt-6 flex flex-wrap gap-4 text-xs text-white/40"><span className="flex items-center gap-1.5"><Users aria-hidden="true" className="size-3.5" />{memberships?.length ?? 0} members</span>{periodLabel && <span className="flex items-center gap-1.5"><CalendarDays aria-hidden="true" className="size-3.5" />{periodLabel}</span>}</div></div>
          <div className="flex items-center gap-4">
            <span className="text-sm text-white/45">{boardTickets.length} {isClient ? "requests" : "tickets"}</span>
            {canCreateTicket && <TicketComposer clientRequest={roleRecord?.role === "client"} members={ticketMembers} projectId={project.id} />}
            {roleRecord?.role === "admin" && <DeleteProjectButton projectId={project.id} projectName={project.name} />}
          </div>
          </div>
        </div>

        <ProjectAnalytics activeTickets={activeTickets} audience={analyticsAudience} billableAmount={billableAmount} budgetAmount={project.budget_amount === null ? null : Number(project.budget_amount)} completedTickets={completedTickets} currency={project.currency} estimatedHours={estimatedHours} loggedHours={loggedHours} periodLabel={periodLabel} retainerHours={project.retainer_hours === null ? null : Number(project.retainer_hours)} />

        {roleRecord?.role === "admin" && <ProjectAdminSettings budgetAmount={project.budget_amount === null ? null : Number(project.budget_amount)} currency={project.currency} periodEnd={project.retainer_period_end} periodStart={project.retainer_period_start} projectId={project.id} retainerHours={project.retainer_hours === null ? null : Number(project.retainer_hours)} selectedMemberIds={(memberships ?? []).map((membership) => membership.user_id)} users={userOptions} />}

        <div className="mt-10"><div className="mb-4"><p className="eyebrow">Delivery</p><h2 className="font-display mt-2 text-3xl leading-none">{isClient ? "Request status" : "Task board"}</h2>{isClient && <p className="mt-2 text-sm text-slate-500">Follow submitted requests from intake through delivery.</p>}</div><KanbanBoard canManage={canManage} clientView={isClient} projectId={project.id} tickets={boardTickets} /></div>
      </div>
    </main>
  );
}
