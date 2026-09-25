import Link from "next/link";
import { AlertTriangle, ArrowRight, CalendarDays, CheckCircle2, Clock3, FolderKanban, Gauge, ListChecks, ShieldCheck, Sparkles, UserPlus } from "lucide-react";
import { AppHeader } from "@/components/app-header";
import { InviteUserForm } from "@/components/dashboard/invite-user-form";
import { AdminUserList } from "@/components/dashboard/admin-user-list";
import { ClientMonthlyReport } from "@/components/dashboard/client-sprint-report";
import { ArchivedTicketList } from "@/components/projects/archived-ticket-list";
import { KanbanBoard } from "@/components/projects/kanban-board";
import { TicketComposer } from "@/components/projects/ticket-composer";
import { requireUser } from "@/lib/auth/session";
import { isAppRole, ROLE_LABELS } from "@/lib/auth/roles";
import { getMonthWindow, getRecentMonthWindows } from "@/lib/projects/months";
import { isTicketPriority, isTicketStatus, isTicketType } from "@/lib/projects/validation";

export const metadata = { title: "Dashboard" };
export const instant = false;

function stringClaim(value: unknown) {
  return typeof value === "string" ? value : "";
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat("en", { month: "short", day: "numeric", timeZone: "UTC" }).format(new Date(`${value}T00:00:00Z`));
}

export default async function DashboardPage() {
  const { supabase, claims } = await requireUser();
  const userId = stringClaim(claims.sub);
  const email = stringClaim(claims.email);
  const metadata = claims.user_metadata && typeof claims.user_metadata === "object"
    ? claims.user_metadata as Record<string, unknown>
    : {};
  const metadataName = stringClaim(metadata.full_name);
  const [{ data: profile }, { data: roleRecord }] = userId
    ? await Promise.all([
        supabase.from("profiles").select("full_name").eq("id", userId).maybeSingle(),
        supabase.from("user_roles").select("role").eq("user_id", userId).maybeSingle(),
      ])
    : [{ data: null }, { data: null }];
  const fullName = profile?.full_name || metadataName || email.split("@")[0] || "there";
  const firstName = fullName.split(" ")[0];
  const role = roleRecord?.role && isAppRole(roleRecord.role) ? roleRecord.role : null;
  const isClient = role === "client";

  const { data: projects } = await supabase
    .from("projects")
    .select("id, name, description, project_type, retainer_hours, sprint_start_date, status, risk, rollover_enabled, rollover_cap_hours")
    .order("created_at", { ascending: false });
  const projectIds = (projects ?? []).map((project) => project.id);
  const clientProject = isClient ? projects?.[0] : null;
  const currentMonth = getMonthWindow();
  const previousMonth = getMonthWindow(new Date(), -1);
  const reportMonths = getRecentMonthWindows(6);
  const [{ data: tickets }, { data: timeEntries }, { data: committedHoursResult }] = projectIds.length
    ? await Promise.all([
        supabase.from("tickets").select("id, project_id, title, description, status, priority, ticket_type, due_date, assignee_id, estimated_hours, logged_hours, billable_amount, created_at, updated_at").in("project_id", projectIds).order("created_at", { ascending: false }),
        isClient ? supabase.rpc("get_project_daily_time_totals", { period_start: reportMonths[0].start, period_end: currentMonth.endExclusive }) : Promise.resolve({ data: [] as Array<{ project_id: string; hours: number; work_date: string }> }),
        clientProject ? supabase.rpc("get_project_committed_hours", { target_project_id: clientProject.id }) : Promise.resolve({ data: 0 }),
      ])
    : [{ data: [] }, { data: [] }, { data: 0 }];
  const projectById = new Map((projects ?? []).map((project) => [project.id, project]));
  const visibleTickets = (tickets ?? []).filter((ticket) => ticket.status !== "archived");
  const activeTickets = visibleTickets.filter((ticket) => ticket.status !== "completed");
  const completedTickets = visibleTickets.filter((ticket) => ticket.status === "completed");
  const assignedToMe = activeTickets.filter((ticket) => ticket.assignee_id === userId);
  const today = new Date().toISOString().slice(0, 10);
  const overdueTickets = activeTickets.filter((ticket) => ticket.due_date && ticket.due_date < today);
  const unassignedTickets = activeTickets.filter((ticket) => !ticket.assignee_id);
  const attentionTickets = [...overdueTickets, ...unassignedTickets.filter((ticket) => !overdueTickets.some((overdue) => overdue.id === ticket.id))]
    .slice(0, 6);
  const monthlyHours = new Map<string, number>();
  const previousMonthlyHours = new Map<string, number>();
  const dailyTimeEntries = (timeEntries ?? []) as Array<{ project_id: string; hours: number; work_date: string }>;
  dailyTimeEntries.forEach((entry) => {
    const entryDate = entry.work_date;
    if (entryDate >= currentMonth.start && entryDate < currentMonth.endExclusive) monthlyHours.set(entry.project_id, (monthlyHours.get(entry.project_id) ?? 0) + Number(entry.hours));
    else if (entryDate >= previousMonth.start && entryDate < previousMonth.endExclusive) previousMonthlyHours.set(entry.project_id, (previousMonthlyHours.get(entry.project_id) ?? 0) + Number(entry.hours));
  });
  const retainers = (projects ?? []).filter((project) => project.project_type === "retainer");
  const totalRetainer = retainers.reduce((total, project) => {
    const base = Number(project.retainer_hours ?? 0);
    const previousUnused = Math.max(0, base - Math.max(0, previousMonthlyHours.get(project.id) ?? 0));
    const rollover = project.rollover_enabled ? Math.min(previousUnused, project.rollover_cap_hours === null ? previousUnused : Number(project.rollover_cap_hours)) : 0;
    return total + base + rollover;
  }, 0);
  const totalMonthlyLogged = retainers.reduce((total, project) => total + Math.max(0, monthlyHours.get(project.id) ?? 0), 0);
  const committedHours = Math.max(0, Number(committedHoursResult ?? 0));
  const remainingRetainer = Math.max(0, totalRetainer - totalMonthlyLogged - committedHours);
  const clientMonthPoints = clientProject ? reportMonths.map((month) => ({
    label: month.shortLabel,
    used: dailyTimeEntries.filter((entry) => entry.project_id === clientProject.id && entry.work_date >= month.start && entry.work_date < month.endExclusive).reduce((sum, entry) => sum + Number(entry.hours), 0),
    capacity: Number(clientProject.retainer_hours ?? 0),
  })) : [];
  const clientBoardTickets = (tickets ?? []).filter((ticket) => ticket.project_id === clientProject?.id && ticket.status !== "archived" && isTicketStatus(ticket.status) && isTicketPriority(ticket.priority) && isTicketType(ticket.ticket_type)).map((ticket) => ({ ...ticket, status: ticket.status as NonNullable<typeof ticket.status>, priority: ticket.priority as NonNullable<typeof ticket.priority>, ticket_type: ticket.ticket_type as NonNullable<typeof ticket.ticket_type>, estimated_hours: Number(ticket.estimated_hours ?? 0), logged_hours: Number(ticket.logged_hours ?? 0) }));
  const clientArchivedTickets = (tickets ?? [])
    .filter((ticket) => ticket.project_id === clientProject?.id && ticket.status === "archived")
    .map((ticket) => ({
      id: ticket.id,
      title: ticket.title,
      archivedAt: ticket.updated_at,
      estimatedHours: Number(ticket.estimated_hours ?? 0),
      loggedHours: 0,
    }));

  return (
    <main className="min-h-svh bg-[#f6f3ee] text-slate-950">
      <AppHeader />
      <div className="mx-auto max-w-7xl px-5 py-8 sm:px-8 sm:py-12">
        <section className="relative overflow-hidden rounded-[2rem] bg-[#171717] px-6 py-8 text-white shadow-[0_24px_70px_rgba(23,23,23,0.16)] sm:px-9 sm:py-10">
          <div className="absolute -right-16 -top-28 size-72 rounded-full bg-[#f00073] opacity-20 blur-[90px]" />
          <div className="relative flex flex-col justify-between gap-7 sm:flex-row sm:items-end">
            <div>
              <p className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.2em] text-[#ff64ad]"><Sparkles aria-hidden="true" className="size-4" />{isClient ? "Client workroom" : "Delivery command center"}</p>
              <h1 className="mt-4 text-4xl leading-none sm:text-6xl">Welcome, {firstName}.</h1>
              <p className="mt-4 max-w-2xl text-sm leading-6 text-white/55">{isClient ? "Request work, follow delivery, and see exactly where your active projects stand." : "Focus on what needs attention, what is due next, and where the team should move work forward."}</p>
            </div>
            <div className="flex items-center gap-2 rounded-full border border-white/10 bg-white/[0.06] px-4 py-2 text-xs text-white/65">
              {role === "admin" ? <ShieldCheck aria-hidden="true" className="size-4 text-[#f00073]" /> : <CalendarDays aria-hidden="true" className="size-4" />}
              {role ? ROLE_LABELS[role] : "Role pending"}
            </div>
          </div>
        </section>

        {isClient ? (
          <>
            <section aria-label="Account delivery summary" className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              <article className="rounded-2xl border border-[#171717] bg-[#171717] p-5 text-white shadow-sm"><span className="grid size-10 place-items-center rounded-xl bg-pink-600"><FolderKanban aria-hidden="true" className="size-5" /></span><p className="mt-5 text-sm text-white/50">Workspace</p><p className="mt-1 truncate text-xl font-semibold">{clientProject?.name ?? "Not assigned"}</p></article>
              <article className="rounded-2xl border border-stone-200 bg-white p-5 shadow-sm"><span className="grid size-10 place-items-center rounded-xl bg-blue-50 text-blue-600"><ListChecks aria-hidden="true" className="size-5" /></span><p className="mt-5 text-sm text-slate-500">Active requests</p><p className="mt-1 text-3xl font-semibold">{activeTickets.length}</p></article>
              <article className="rounded-2xl border border-stone-200 bg-white p-5 shadow-sm"><span className="grid size-10 place-items-center rounded-xl bg-emerald-50 text-emerald-600"><CheckCircle2 aria-hidden="true" className="size-5" /></span><p className="mt-5 text-sm text-slate-500">Delivered</p><p className="mt-1 text-3xl font-semibold">{completedTickets.length}</p></article>
              <article className="rounded-2xl border border-stone-200 bg-white p-5 shadow-sm"><span className="grid size-10 place-items-center rounded-xl bg-pink-50 text-pink-600"><Gauge aria-hidden="true" className="size-5" /></span><p className="mt-5 text-sm text-slate-500">Retainer available this month</p><p className="mt-1 text-3xl font-semibold">{totalRetainer > 0 ? `${remainingRetainer.toFixed(1)}h` : "—"}</p>{totalRetainer > 0 && <p className="mt-2 text-xs text-slate-400">{totalMonthlyLogged.toFixed(1)}h used · {committedHours.toFixed(1)}h approved</p>}</article>
            </section>

            {clientProject ? <>
              <section className="mt-10 rounded-2xl border border-stone-200 bg-white p-6 shadow-sm"><div className="flex flex-col justify-between gap-5 sm:flex-row sm:items-center"><div><p className="text-xs font-semibold uppercase tracking-[0.16em] text-pink-600">{clientProject.project_type === "retainer" ? "Retainer workspace" : "New build workspace"}</p><h2 className="font-display mt-2 text-3xl">{clientProject.name}</h2><p className="mt-2 max-w-2xl text-sm leading-6 text-slate-500">{clientProject.description || "Submit requests, follow approvals, and review delivery from one shared workspace."}</p></div><TicketComposer clientRequest projectId={clientProject.id}/></div></section>
              <div className="mt-8"><ClientMonthlyReport points={clientMonthPoints}/></div>
              <section className="mt-10"><div className="mb-5 flex items-end justify-between gap-4"><div><p className="eyebrow">Request workflow</p><h2 className="font-display mt-2 text-3xl">Delivery board</h2><p className="mt-2 text-sm text-slate-500">Track requests from submission and estimate approval through UAT and delivery.</p></div><span className="text-sm text-slate-400">{clientBoardTickets.length} requests</span></div><KanbanBoard canManage={false} clientView projectId={clientProject.id} tickets={clientBoardTickets}/></section>
              <ArchivedTicketList clientView projectId={clientProject.id} tickets={clientArchivedTickets} />
            </> : <div className="mt-10 rounded-2xl border border-dashed border-stone-300 bg-white px-6 py-14 text-center"><FolderKanban aria-hidden="true" className="mx-auto size-9 text-slate-300" /><h3 className="mt-4 font-semibold">No workspace assigned yet</h3><p className="mt-1 text-sm text-slate-500">Your agency contact will connect your account when the workspace is ready.</p></div>}
          </>
        ) : (
          <>
            <section aria-label="Delivery summary" className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              <article className="rounded-2xl border border-[#171717] bg-[#171717] p-5 text-white shadow-sm"><p className="text-sm text-white/50">My active work</p><p className="mt-2 text-3xl font-semibold">{assignedToMe.length}</p><Link className="mt-4 inline-flex items-center gap-1 text-xs font-medium text-pink-300 hover:text-pink-200" href="/my-tasks">Open my tasks<ArrowRight aria-hidden="true" className="size-3" /></Link></article>
              <article className={`rounded-2xl border p-5 shadow-sm ${overdueTickets.length ? "border-red-200 bg-red-50" : "border-stone-200 bg-white"}`}><p className={overdueTickets.length ? "text-sm text-red-700" : "text-sm text-slate-500"}>Overdue</p><p className={`mt-2 text-3xl font-semibold ${overdueTickets.length ? "text-red-700" : ""}`}>{overdueTickets.length}</p><p className="mt-4 text-xs text-slate-500">Across accessible projects</p></article>
              <article className="rounded-2xl border border-stone-200 bg-white p-5 shadow-sm"><p className="text-sm text-slate-500">Unassigned</p><p className="mt-2 text-3xl font-semibold">{unassignedTickets.length}</p><p className="mt-4 text-xs text-slate-500">Waiting for an owner</p></article>
              <article className="rounded-2xl border border-stone-200 bg-white p-5 shadow-sm"><p className="text-sm text-slate-500">Active projects</p><p className="mt-2 text-3xl font-semibold">{projects?.length ?? 0}</p><Link className="mt-4 inline-flex items-center gap-1 text-xs font-medium text-pink-600 hover:text-pink-500" href="/projects">Open portfolio<ArrowRight aria-hidden="true" className="size-3" /></Link></article>
            </section>

            <div className="mt-10 grid gap-6 lg:grid-cols-[minmax(0,1.2fr)_minmax(20rem,.8fr)]">
              <section aria-labelledby="next-work-heading" className="overflow-hidden rounded-2xl border border-stone-200 bg-white shadow-sm">
                <div className="flex items-center justify-between border-b border-stone-100 px-5 py-5 sm:px-7"><div><h2 className="text-lg font-semibold" id="next-work-heading">My next work</h2><p className="mt-1 text-sm text-slate-500">Assigned items ordered by due date.</p></div><Clock3 aria-hidden="true" className="size-5 text-pink-600" /></div>
                {assignedToMe.length ? <div className="divide-y divide-stone-100">{assignedToMe.sort((left, right) => (left.due_date ?? "9999").localeCompare(right.due_date ?? "9999")).slice(0, 6).map((ticket) => <Link className="group flex items-center justify-between gap-4 px-5 py-4 hover:bg-stone-50 sm:px-7" href={`/projects/${ticket.project_id}/tickets/${ticket.id}`} key={ticket.id}><div className="min-w-0"><p className="truncate text-sm font-semibold group-hover:text-pink-600">{ticket.title}</p><p className="mt-1 text-xs text-slate-500">{projectById.get(ticket.project_id)?.name ?? "Project"}</p></div><span className={`shrink-0 text-xs ${ticket.due_date && ticket.due_date < today ? "font-semibold text-red-600" : "text-slate-500"}`}>{ticket.due_date ? formatDate(ticket.due_date) : "No due date"}</span></Link>)}</div> : <div className="px-6 py-14 text-center"><CheckCircle2 aria-hidden="true" className="mx-auto size-9 text-emerald-500" /><h3 className="mt-4 font-semibold">You’re caught up</h3><p className="mt-1 text-sm text-slate-500">No active tickets are assigned to you.</p></div>}
              </section>

              <section aria-labelledby="attention-heading" className="overflow-hidden rounded-2xl border border-stone-200 bg-white shadow-sm">
                <div className="flex items-center gap-3 border-b border-stone-100 px-5 py-5"><span className="grid size-9 place-items-center rounded-xl bg-amber-50 text-amber-600"><AlertTriangle aria-hidden="true" className="size-4" /></span><div><h2 className="font-semibold" id="attention-heading">Needs attention</h2><p className="mt-0.5 text-xs text-slate-500">Overdue or unassigned work.</p></div></div>
                {attentionTickets.length ? <div className="divide-y divide-stone-100">{attentionTickets.map((ticket) => <Link className="block px-5 py-4 hover:bg-stone-50" href={`/projects/${ticket.project_id}/tickets/${ticket.id}`} key={ticket.id}><div className="flex items-start justify-between gap-3"><p className="line-clamp-2 text-sm font-medium">{ticket.title}</p><span className={`shrink-0 rounded px-2 py-0.5 text-[10px] font-semibold uppercase ${ticket.due_date && ticket.due_date < today ? "bg-red-50 text-red-700" : "bg-amber-50 text-amber-700"}`}>{ticket.due_date && ticket.due_date < today ? "Overdue" : "Unassigned"}</span></div><p className="mt-1 text-xs text-slate-500">{projectById.get(ticket.project_id)?.name ?? "Project"}</p></Link>)}</div> : <p className="px-5 py-10 text-center text-sm text-slate-500">Nothing needs immediate attention.</p>}
              </section>
            </div>
          </>
        )}

        {role === "admin" && (
          <details className="mt-10 overflow-hidden rounded-2xl border border-stone-200 bg-white shadow-sm">
            <summary className="flex cursor-pointer list-none items-center gap-3 px-5 py-5 font-semibold marker:hidden sm:px-7"><span className="grid size-9 place-items-center rounded-xl bg-pink-50 text-pink-600"><UserPlus aria-hidden="true" className="size-4" /></span>People and access administration</summary>
            <div className="border-t border-stone-100 p-5 sm:p-7"><div className="mb-5"><h2 className="font-semibold">Invite a team member or client</h2><p className="mt-1 text-sm text-slate-500">Assign their role before sending the secure account invitation.</p></div><InviteUserForm /></div>
          </details>
        )}
        {role === "admin" && <AdminUserList />}
      </div>
    </main>
  );
}
