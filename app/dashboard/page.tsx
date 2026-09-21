import Link from "next/link";
import { AlertTriangle, ArrowRight, CalendarDays, CheckCircle2, Clock3, FolderKanban, Gauge, ListChecks, Plus, ShieldCheck, Sparkles, UserPlus } from "lucide-react";
import { AppHeader } from "@/components/app-header";
import { InviteUserForm } from "@/components/dashboard/invite-user-form";
import { AdminUserList } from "@/components/dashboard/admin-user-list";
import { Button } from "@/components/ui/button";
import { requireUser } from "@/lib/auth/session";
import { isAppRole, ROLE_LABELS } from "@/lib/auth/roles";

export const metadata = { title: "Dashboard" };
export const instant = false;

function stringClaim(value: unknown) {
  return typeof value === "string" ? value : "";
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat("en", { month: "short", day: "numeric", timeZone: "UTC" }).format(new Date(`${value}T00:00:00Z`));
}

function statusLabel(status: string, client = false) {
  if (status === "backlog") return client ? "Submitted" : "Backlog";
  if (status === "in_progress") return "In progress";
  if (status === "completed") return client ? "Delivered" : "Completed";
  return "Archived";
}

function statusClasses(status: string) {
  if (status === "completed") return "bg-emerald-50 text-emerald-700";
  if (status === "in_progress") return "bg-blue-50 text-blue-700";
  if (status === "archived") return "bg-stone-100 text-slate-500";
  return "bg-amber-50 text-amber-700";
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
    .select("id, name, description, retainer_hours, budget_amount, currency")
    .order("created_at", { ascending: false });
  const projectIds = (projects ?? []).map((project) => project.id);
  const { data: tickets } = projectIds.length
    ? await supabase
        .from("tickets")
        .select("id, project_id, title, status, priority, due_date, assignee_id, logged_hours, billable_amount, created_at")
        .in("project_id", projectIds)
        .order("created_at", { ascending: false })
    : { data: [] };
  const projectById = new Map((projects ?? []).map((project) => [project.id, project]));
  const visibleTickets = (tickets ?? []).filter((ticket) => ticket.status !== "archived");
  const activeTickets = visibleTickets.filter((ticket) => ticket.status === "backlog" || ticket.status === "in_progress");
  const completedTickets = visibleTickets.filter((ticket) => ticket.status === "completed");
  const assignedToMe = activeTickets.filter((ticket) => ticket.assignee_id === userId);
  const today = new Date().toISOString().slice(0, 10);
  const overdueTickets = activeTickets.filter((ticket) => ticket.due_date && ticket.due_date < today);
  const unassignedTickets = activeTickets.filter((ticket) => !ticket.assignee_id);
  const attentionTickets = [...overdueTickets, ...unassignedTickets.filter((ticket) => !overdueTickets.some((overdue) => overdue.id === ticket.id))]
    .slice(0, 6);
  const totalRetainer = (projects ?? []).reduce((total, project) => total + Number(project.retainer_hours ?? 0), 0);
  const totalLogged = visibleTickets.reduce((total, ticket) => total + Number(ticket.logged_hours ?? 0), 0);
  const remainingRetainer = Math.max(0, totalRetainer - totalLogged);

  const projectStats = new Map<string, { active: number; completed: number; logged: number }>();
  visibleTickets.forEach((ticket) => {
    const current = projectStats.get(ticket.project_id) ?? { active: 0, completed: 0, logged: 0 };
    if (ticket.status === "completed") current.completed += 1;
    if (ticket.status === "backlog" || ticket.status === "in_progress") current.active += 1;
    current.logged += Number(ticket.logged_hours ?? 0);
    projectStats.set(ticket.project_id, current);
  });

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
              <article className="rounded-2xl border border-[#171717] bg-[#171717] p-5 text-white shadow-sm"><span className="grid size-10 place-items-center rounded-xl bg-pink-600"><FolderKanban aria-hidden="true" className="size-5" /></span><p className="mt-5 text-sm text-white/50">Assigned projects</p><p className="mt-1 text-3xl font-semibold">{projects?.length ?? 0}</p></article>
              <article className="rounded-2xl border border-stone-200 bg-white p-5 shadow-sm"><span className="grid size-10 place-items-center rounded-xl bg-blue-50 text-blue-600"><ListChecks aria-hidden="true" className="size-5" /></span><p className="mt-5 text-sm text-slate-500">Active requests</p><p className="mt-1 text-3xl font-semibold">{activeTickets.length}</p></article>
              <article className="rounded-2xl border border-stone-200 bg-white p-5 shadow-sm"><span className="grid size-10 place-items-center rounded-xl bg-emerald-50 text-emerald-600"><CheckCircle2 aria-hidden="true" className="size-5" /></span><p className="mt-5 text-sm text-slate-500">Delivered</p><p className="mt-1 text-3xl font-semibold">{completedTickets.length}</p></article>
              <article className="rounded-2xl border border-stone-200 bg-white p-5 shadow-sm"><span className="grid size-10 place-items-center rounded-xl bg-pink-50 text-pink-600"><Gauge aria-hidden="true" className="size-5" /></span><p className="mt-5 text-sm text-slate-500">Retainer available</p><p className="mt-1 text-3xl font-semibold">{totalRetainer > 0 ? `${remainingRetainer.toFixed(1)}h` : "—"}</p></article>
            </section>

            <section aria-labelledby="client-projects-heading" className="mt-10">
              <div className="mb-4 flex items-end justify-between gap-4"><div><p className="eyebrow">Your workspace</p><h2 className="font-display mt-2 text-3xl" id="client-projects-heading">Assigned projects</h2></div><Link className="text-sm font-medium text-pink-600 hover:text-pink-500" href="/projects">View all</Link></div>
              {(projects ?? []).length ? <div className="grid gap-4 lg:grid-cols-2">{projects?.slice(0, 4).map((project) => {
                const stats = projectStats.get(project.id) ?? { active: 0, completed: 0, logged: 0 };
                const projectRetainer = Number(project.retainer_hours ?? 0);
                const remaining = Math.max(0, projectRetainer - stats.logged);
                return <article className="rounded-2xl border border-stone-200 bg-white p-6 shadow-sm" key={project.id}><div className="flex items-start justify-between gap-4"><div><p className="text-xs font-semibold uppercase tracking-[0.16em] text-pink-600">Active engagement</p><h3 className="font-display mt-2 text-2xl">{project.name}</h3></div><span className="grid size-10 place-items-center rounded-xl bg-pink-50 text-pink-600"><FolderKanban aria-hidden="true" className="size-5" /></span></div><div className="mt-5 grid grid-cols-3 gap-3 rounded-xl bg-stone-50 p-4"><div><p className="text-[10px] uppercase tracking-wide text-slate-400">Open</p><p className="mt-1 font-semibold">{stats.active}</p></div><div><p className="text-[10px] uppercase tracking-wide text-slate-400">Delivered</p><p className="mt-1 font-semibold">{stats.completed}</p></div><div><p className="text-[10px] uppercase tracking-wide text-slate-400">Retainer</p><p className="mt-1 font-semibold">{projectRetainer > 0 ? `${remaining.toFixed(1)}h` : "—"}</p></div></div><div className="mt-5 flex flex-wrap gap-2"><Button asChild className="bg-pink-600 hover:bg-pink-500"><Link href={`/projects/${project.id}?new=request`}><Plus aria-hidden="true" />Submit a request</Link></Button><Button asChild variant="outline"><Link href={`/projects/${project.id}`}>Open project<ArrowRight aria-hidden="true" /></Link></Button></div></article>;
              })}</div> : <div className="rounded-2xl border border-dashed border-stone-300 bg-white px-6 py-14 text-center"><FolderKanban aria-hidden="true" className="mx-auto size-9 text-slate-300" /><h3 className="mt-4 font-semibold">No projects assigned yet</h3><p className="mt-1 text-sm text-slate-500">Your agency contact will add you when your workspace is ready.</p></div>}
            </section>

            <section aria-labelledby="recent-requests-heading" className="mt-10 overflow-hidden rounded-2xl border border-stone-200 bg-white shadow-sm">
              <div className="flex items-center justify-between border-b border-stone-100 px-5 py-5 sm:px-7"><div><h2 className="text-lg font-semibold" id="recent-requests-heading">Recent requests</h2><p className="mt-1 text-sm text-slate-500">The latest activity across your assigned projects.</p></div><span className="text-sm text-slate-400">{visibleTickets.length} total</span></div>
              {visibleTickets.length ? <div className="divide-y divide-stone-100">{visibleTickets.slice(0, 6).map((ticket) => <Link className="group grid gap-2 px-5 py-4 transition hover:bg-stone-50 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center sm:px-7" href={`/projects/${ticket.project_id}/tickets/${ticket.id}`} key={ticket.id}><div className="min-w-0"><p className="truncate text-sm font-semibold group-hover:text-pink-600">{ticket.title}</p><p className="mt-1 text-xs text-slate-500">{projectById.get(ticket.project_id)?.name ?? "Project"}</p></div><span className={`w-fit rounded-full px-2.5 py-1 text-xs font-medium ${statusClasses(ticket.status)}`}>{statusLabel(ticket.status, true)}</span></Link>)}</div> : <div className="px-6 py-12 text-center text-sm text-slate-500">No requests have been submitted yet.</div>}
            </section>
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
