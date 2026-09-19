import Link from "next/link";
import { AlertTriangle, CalendarDays, CheckCircle2, Clock3, ListChecks } from "lucide-react";
import { AppHeader } from "@/components/app-header";
import { requireUser } from "@/lib/auth/session";
import { isTicketStatus } from "@/lib/projects/validation";
import { notFound } from "next/navigation";

export const metadata = { title: "My tasks" };
export const instant = false;

type TaskRow = {
  id: string;
  kind: "ticket" | "subtask";
  title: string;
  projectId: string;
  projectName: string;
  ticketId: string;
  dueDate: string | null;
  estimatedHours: number;
  loggedHours: number;
  status: string;
};

const statusLabels: Record<string, string> = {
  backlog: "Backlog",
  in_progress: "In progress",
};

function formatDate(value: string) {
  return new Intl.DateTimeFormat("en", { month: "short", day: "numeric", year: "numeric", timeZone: "UTC" }).format(new Date(`${value}T00:00:00Z`));
}

function formatHours(value: number) {
  return value.toLocaleString("en-US", { maximumFractionDigits: 2 });
}

export default async function MyTasksPage() {
  const { supabase, claims } = await requireUser();
  const userId = typeof claims.sub === "string" ? claims.sub : "";
  const { data: roleRecord } = await supabase.from("user_roles").select("role").eq("user_id", userId).maybeSingle();
  if (roleRecord?.role === "client") notFound();

  const [{ data: assignedTickets, error: ticketError }, { data: assignedSubtasks, error: subtaskError }] = await Promise.all([
    supabase.from("tickets").select("id, project_id, title, due_date, estimated_hours, logged_hours, status").eq("assignee_id", userId),
    supabase.from("ticket_subtasks").select("id, ticket_id, title, due_date, estimated_hours, logged_hours, is_completed").eq("assignee_id", userId).eq("is_completed", false),
  ]);

  const incompleteTickets = (assignedTickets ?? []).filter((ticket) => isTicketStatus(ticket.status) && ticket.status !== "completed" && ticket.status !== "archived");
  const parentTicketIds = [...new Set((assignedSubtasks ?? []).map((subtask) => subtask.ticket_id))];
  const { data: parentTickets } = parentTicketIds.length
    ? await supabase.from("tickets").select("id, project_id, status").in("id", parentTicketIds)
    : { data: [] };
  const parentById = new Map(parentTickets?.map((ticket) => [ticket.id, ticket]));
  const projectIds = [...new Set([
    ...incompleteTickets.map((ticket) => ticket.project_id),
    ...(parentTickets ?? []).map((ticket) => ticket.project_id),
  ])];
  const { data: projects } = projectIds.length
    ? await supabase.from("projects").select("id, name").in("id", projectIds)
    : { data: [] };
  const projectById = new Map(projects?.map((project) => [project.id, project.name]));

  const tasks: TaskRow[] = [
    ...incompleteTickets.map((ticket) => ({
      id: ticket.id,
      kind: "ticket" as const,
      title: ticket.title,
      projectId: ticket.project_id,
      projectName: projectById.get(ticket.project_id) || "Project",
      ticketId: ticket.id,
      dueDate: ticket.due_date,
      estimatedHours: Number(ticket.estimated_hours ?? 0),
      loggedHours: Number(ticket.logged_hours ?? 0),
      status: statusLabels[ticket.status] || ticket.status,
    })),
    ...(assignedSubtasks ?? []).flatMap((subtask) => {
      const parent = parentById.get(subtask.ticket_id);
      if (!parent || parent.status === "completed" || parent.status === "archived") return [];
      return [{
        id: subtask.id,
        kind: "subtask" as const,
        title: subtask.title,
        projectId: parent.project_id,
        projectName: projectById.get(parent.project_id) || "Project",
        ticketId: subtask.ticket_id,
        dueDate: subtask.due_date,
        estimatedHours: Number(subtask.estimated_hours ?? 0),
        loggedHours: Number(subtask.logged_hours ?? 0),
        status: "To do",
      }];
    }),
  ].sort((left, right) => {
    if (left.dueDate && right.dueDate) return left.dueDate.localeCompare(right.dueDate) || left.title.localeCompare(right.title);
    if (left.dueDate) return -1;
    if (right.dueDate) return 1;
    return left.title.localeCompare(right.title);
  });

  const hoursByDate = new Map<string, number>();
  tasks.forEach((task) => {
    if (task.dueDate) hoursByDate.set(task.dueDate, (hoursByDate.get(task.dueDate) ?? 0) + task.estimatedHours);
  });
  const overloadedDays = [...hoursByDate.entries()].filter(([, hours]) => hours > 7).sort(([left], [right]) => left.localeCompare(right));
  const today = new Date().toISOString().slice(0, 10);
  const overdueCount = tasks.filter((task) => task.dueDate && task.dueDate < today).length;
  const totalEstimated = tasks.reduce((total, task) => total + task.estimatedHours, 0);
  const totalLogged = tasks.reduce((total, task) => total + task.loggedHours, 0);

  return (
    <main className="min-h-svh bg-[#f6f3ee] text-slate-950">
      <AppHeader />
      <div className="mx-auto max-w-6xl px-5 py-10 sm:px-8 sm:py-14">
        <div className="relative overflow-hidden rounded-[2rem] bg-[#171717] px-6 py-8 text-white shadow-[0_24px_70px_rgba(23,23,23,.14)] sm:px-9 sm:py-10"><div className="absolute -right-14 -top-24 size-64 rounded-full bg-[#f00073] opacity-20 blur-[80px]" /><div className="relative flex flex-col justify-between gap-5 sm:flex-row sm:items-end"><div><p className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.2em] text-[#ff64ad]"><ListChecks aria-hidden="true" className="size-4" />Personal workload</p><h1 className="mt-4 text-5xl leading-none sm:text-6xl">My tasks</h1><p className="mt-4 max-w-xl text-sm text-white/55">Incomplete tickets and subtasks assigned to you, ordered by due date.</p></div><p className="rounded-full border border-white/10 bg-white/[0.06] px-4 py-2 text-xs text-white/60">7 hours daily capacity</p></div></div>

        {(ticketError || subtaskError) && <div className="mt-8 rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800" role="alert">Task time tracking is not available yet. Apply the latest Supabase migration and reload this page.</div>}

        <section aria-label="Task summary" className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <article className="rounded-2xl border border-stone-200 bg-white p-5 shadow-sm"><p className="text-sm text-slate-500">Incomplete</p><p className="mt-2 text-2xl font-semibold">{tasks.length}</p></article>
          <article className="rounded-2xl border border-stone-200 bg-white p-5 shadow-sm"><p className="text-sm text-slate-500">Overdue</p><p className={`mt-2 text-2xl font-semibold ${overdueCount ? "text-red-600" : ""}`}>{overdueCount}</p></article>
          <article className="rounded-2xl border border-stone-200 bg-white p-5 shadow-sm"><p className="text-sm text-slate-500">Estimated / logged</p><p className="mt-2 text-2xl font-semibold">{formatHours(totalEstimated)}h <span className="text-base font-normal text-slate-400">/ {formatHours(totalLogged)}h</span></p></article>
          <article className={`rounded-2xl border p-5 shadow-sm ${overloadedDays.length ? "border-red-200 bg-red-50" : "border-stone-200 bg-white"}`}><p className={overloadedDays.length ? "text-sm text-red-700" : "text-sm text-slate-500"}>Overloaded days</p><p className={`mt-2 text-2xl font-semibold ${overloadedDays.length ? "text-red-700" : ""}`}>{overloadedDays.length}</p></article>
        </section>

        {overloadedDays.length > 0 && <section aria-labelledby="capacity-heading" className="mt-6 rounded-2xl border border-red-200 bg-red-50 p-5"><div className="flex items-start gap-3"><AlertTriangle aria-hidden="true" className="mt-0.5 size-5 shrink-0 text-red-600" /><div><h2 className="font-semibold text-red-900" id="capacity-heading">Daily capacity exceeded</h2><p className="mt-1 text-sm text-red-800">These dates have more than seven estimated hours assigned.</p><div className="mt-3 flex flex-wrap gap-2">{overloadedDays.map(([date, hours]) => <span className="rounded-full bg-white px-3 py-1 text-xs font-semibold text-red-700 shadow-sm" key={date}>{formatDate(date)} · {formatHours(hours)}h</span>)}</div></div></div></section>}

        <section aria-labelledby="task-list-heading" className="mt-8 overflow-hidden rounded-2xl border border-stone-200 bg-white shadow-sm">
          <div className="flex items-center justify-between border-b border-stone-100 px-5 py-5 sm:px-7"><h2 className="text-lg font-semibold" id="task-list-heading">Assigned work</h2><span className="text-sm text-slate-500">{tasks.length} items</span></div>
          {tasks.length ? <div className="divide-y divide-slate-100">{tasks.map((task) => {
            const dayHours = task.dueDate ? hoursByDate.get(task.dueDate) ?? 0 : 0;
            const isOverdue = Boolean(task.dueDate && task.dueDate < today);
            const href = `/projects/${task.projectId}/tickets/${task.ticketId}${task.kind === "subtask" ? `#subtask-${task.id}` : ""}`;
            return <article className="grid gap-4 px-5 py-5 sm:px-7 lg:grid-cols-[minmax(0,1fr)_150px_130px_120px] lg:items-center" key={`${task.kind}-${task.id}`}><div className="min-w-0"><div className="flex flex-wrap items-center gap-2"><span className="rounded bg-stone-100 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-slate-500">{task.kind}</span>{dayHours > 7 && <span className="rounded bg-red-50 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-red-700">{formatHours(dayHours)}h that day</span>}</div><Link className="mt-2 block truncate font-semibold text-slate-900 hover:text-pink-600" href={href}>{task.title}</Link><p className="mt-1 text-xs text-slate-500">{task.projectName}</p></div><div><p className="text-[10px] font-semibold uppercase tracking-wide text-slate-400 lg:hidden">Due date</p><p className={`mt-1 flex items-center gap-1.5 text-sm lg:mt-0 ${isOverdue ? "font-medium text-red-600" : "text-slate-600"}`}><CalendarDays aria-hidden="true" className="size-3.5" />{task.dueDate ? formatDate(task.dueDate) : "No due date"}</p></div><div><p className="text-[10px] font-semibold uppercase tracking-wide text-slate-400 lg:hidden">Time</p><p className="mt-1 flex items-center gap-1.5 text-sm text-slate-600 lg:mt-0"><Clock3 aria-hidden="true" className="size-3.5" />{formatHours(task.estimatedHours)}h / {formatHours(task.loggedHours)}h</p></div><div><p className="text-[10px] font-semibold uppercase tracking-wide text-slate-400 lg:hidden">Status</p><span className="mt-1 inline-flex rounded-full bg-blue-50 px-2.5 py-1 text-xs font-medium text-blue-700 lg:mt-0">{task.status}</span></div></article>;
          })}</div> : <div className="px-6 py-16 text-center"><CheckCircle2 aria-hidden="true" className="mx-auto size-10 text-emerald-500" /><h3 className="mt-4 font-semibold">You’re all caught up</h3><p className="mt-1 text-sm text-slate-500">No incomplete tickets or subtasks are assigned to you.</p></div>}
        </section>
      </div>
    </main>
  );
}
