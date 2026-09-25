import Link from "next/link";
import { redirect } from "next/navigation";
import { ArrowRight, CalendarDays, FolderKanban, Hammer, TimerReset } from "lucide-react";
import { AppHeader } from "@/components/app-header";
import { ProjectComposer } from "@/components/projects/project-composer";
import type { ProjectMemberOption } from "@/components/projects/create-project-form";
import { markdownToPlainText } from "@/components/ui/markdown-content";
import { isAppRole, ROLE_LABELS } from "@/lib/auth/roles";
import { requireUser } from "@/lib/auth/session";
import { formatSprintLabel } from "@/lib/projects/sprints";
import { getMonthWindow } from "@/lib/projects/months";
import { createAdminClient } from "@/lib/supabase/admin";

export const metadata = { title: "Projects" };
export const instant = false;

const statusLabels = { active: "Active", on_hold: "On hold", completed: "Completed" } as const;
const riskLabels = { on_track: "On track", at_risk: "At risk", off_track: "Off track" } as const;
const statusClasses = { active: "bg-blue-50 text-blue-700", on_hold: "bg-stone-100 text-slate-600", completed: "bg-emerald-50 text-emerald-700" } as const;
const riskClasses = { on_track: "bg-emerald-50 text-emerald-700", at_risk: "bg-amber-50 text-amber-700", off_track: "bg-red-50 text-red-700" } as const;

function dollars(value: number) {
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(value);
}

export default async function ProjectsPage() {
  const { supabase, claims } = await requireUser();
  const userId = typeof claims.sub === "string" ? claims.sub : "";
  const [{ data: roleRecord }, { data: projects }] = await Promise.all([
    supabase.from("user_roles").select("role").eq("user_id", userId).maybeSingle(),
    supabase.from("projects").select("id, name, description, created_at, project_type, client_logo_url, repository_url, retainer_hours, hourly_rate, sprint_start_date, status, risk, rollover_enabled, rollover_cap_hours").order("created_at", { ascending: false }),
  ]);
  const role = roleRecord?.role;
  const isClient = role === "client";
  if (isClient) redirect("/dashboard");
  const isManagement = role === "admin" || role === "project_manager";
  const isDeliveryTeam = !isClient && !isManagement;
  const showRates = isManagement;
  const projectRows = (projects ?? []) as Array<{
    id: string; name: string; description: string | null; created_at: string; project_type: "retainer" | "new_build"; client_logo_url: string | null; repository_url: string | null; retainer_hours: number | null; hourly_rate: number | null; sprint_start_date: string; status: "active" | "on_hold" | "completed"; risk: "on_track" | "at_risk" | "off_track"; rollover_enabled: boolean; rollover_cap_hours: number | null;
  }>;
  const projectIds = projectRows.map((project) => project.id);
  const currentMonth = getMonthWindow();
  const previousMonth = getMonthWindow(new Date(), -1);

  const [{ data: tickets }, { data: timeEntries }] = projectIds.length
    ? await Promise.all([
        supabase.from("tickets").select("project_id, status, logged_hours").in("project_id", projectIds),
        isDeliveryTeam
          ? Promise.resolve({ data: [] as Array<{ project_id: string; hours: number; work_date: string }> })
          : supabase.rpc("get_project_daily_time_totals", { period_start: previousMonth.start, period_end: currentMonth.endExclusive }),
      ])
    : [{ data: [] }, { data: [] }];
  const ticketCounts = new Map<string, { total: number; active: number; completed: number }>();
  const monthlyHours = new Map<string, number>();
  const previousMonthlyHours = new Map<string, number>();
  const dailyTimeEntries = (timeEntries ?? []) as Array<{ project_id: string; hours: number; work_date: string }>;

  tickets?.forEach((ticket) => {
    const count = ticketCounts.get(ticket.project_id) ?? { total: 0, active: 0, completed: 0 };
    count.total += 1;
    if (ticket.status !== "completed" && ticket.status !== "archived") count.active += 1;
    if (ticket.status === "completed") count.completed += 1;
    ticketCounts.set(ticket.project_id, count);
  });
  dailyTimeEntries.forEach((entry) => {
    const entryDate = entry.work_date;
    if (entryDate >= currentMonth.start && entryDate < currentMonth.endExclusive) monthlyHours.set(entry.project_id, (monthlyHours.get(entry.project_id) ?? 0) + Number(entry.hours));
    else if (entryDate >= previousMonth.start && entryDate < previousMonth.endExclusive) previousMonthlyHours.set(entry.project_id, (previousMonthlyHours.get(entry.project_id) ?? 0) + Number(entry.hours));
  });

  let memberOptions: ProjectMemberOption[] = [];
  if (role === "admin") {
    try {
      const adminClient = createAdminClient();
      const [{ data: authData }, { data: profiles }, { data: roleRows }] = await Promise.all([
        adminClient.auth.admin.listUsers({ page: 1, perPage: 1000 }),
        adminClient.from("profiles").select("id, full_name"),
        adminClient.from("user_roles").select("user_id, role"),
      ]);
      const profileById = new Map(profiles?.map((profile) => [profile.id, profile.full_name]));
      const roleById = new Map(roleRows?.map((row) => [row.user_id, row.role]));
      memberOptions = (authData?.users ?? []).filter((user) => user.id !== userId).map((user) => {
        const userRole = roleById.get(user.id);
        return { id: user.id, name: profileById.get(user.id) || (typeof user.user_metadata?.full_name === "string" ? user.user_metadata.full_name : "") || user.email?.split("@")[0] || "Unknown user", email: user.email ?? "No email", role: userRole && isAppRole(userRole) ? ROLE_LABELS[userRole] : "No role" };
      });
    } catch {
      memberOptions = [];
    }
  }

  const retainers = projectRows.filter((project) => project.project_type === "retainer");
  const newBuilds = projectRows.filter((project) => project.project_type === "new_build");

  function projectGrid(items: typeof projectRows, type: "retainer" | "new_build") {
    if (!items.length) return <div className="rounded-2xl border border-dashed border-slate-300 bg-white px-6 py-10 text-center"><FolderKanban aria-hidden="true" className="mx-auto size-7 text-slate-300" /><p className="mt-3 text-sm text-slate-500">No {type === "retainer" ? "retainer projects" : "new builds"} yet.</p></div>;
    return <div className="grid gap-4 md:grid-cols-2">{items.map((project) => {
      const count = ticketCounts.get(project.id) ?? { total: 0, active: 0, completed: 0 };
      const usedThisMonth = Math.max(0, monthlyHours.get(project.id) ?? 0);
      const baseHours = Number(project.retainer_hours ?? 0);
      const previousUnused = Math.max(0, baseHours - Math.max(0, previousMonthlyHours.get(project.id) ?? 0));
      const rolloverHours = project.rollover_enabled ? Math.min(previousUnused, project.rollover_cap_hours === null ? previousUnused : Number(project.rollover_cap_hours)) : 0;
      const remainingHours = Math.max(0, baseHours + rolloverHours - usedThisMonth);
      const sprintLabel = formatSprintLabel(project.sprint_start_date);
      return <Link className="group relative overflow-hidden rounded-2xl border border-stone-200 bg-white p-6 shadow-[0_1px_2px_rgba(23,23,23,.04)] transition duration-300 before:absolute before:inset-x-0 before:top-0 before:h-1 before:origin-left before:scale-x-0 before:bg-[#f00073] before:transition-transform hover:-translate-y-1 hover:border-stone-300 hover:shadow-[0_20px_50px_rgba(23,23,23,.09)] hover:before:scale-x-100" href={`/projects/${project.id}`} key={project.id}>
        <div className="flex items-start justify-between gap-4"><div className="flex items-center gap-3">{project.client_logo_url ? <span aria-label={`${project.name} logo`} className="size-11 rounded-xl border border-stone-100 bg-contain bg-center bg-no-repeat" role="img" style={{ backgroundImage: `url(${JSON.stringify(project.client_logo_url).slice(1, -1)})` }} /> : <span className="grid size-11 place-items-center rounded-xl bg-pink-50 text-pink-600">{type === "retainer" ? <TimerReset aria-hidden="true" className="size-5" /> : <Hammer aria-hidden="true" className="size-5" />}</span>}<div className="flex flex-wrap gap-1.5"><span className={`rounded-full px-2.5 py-1 text-[11px] font-semibold ${statusClasses[project.status]}`}>{statusLabels[project.status]}</span><span className={`rounded-full px-2.5 py-1 text-[11px] font-semibold ${riskClasses[project.risk]}`}>{riskLabels[project.risk]}</span></div></div><ArrowRight aria-hidden="true" className="size-5 text-slate-300 transition group-hover:translate-x-1 group-hover:text-pink-500" /></div>
        <h3 className="font-display mt-6 text-2xl leading-tight">{project.name}</h3><p className="mt-1 line-clamp-2 min-h-10 text-sm leading-5 text-slate-500">{project.description ? markdownToPlainText(project.description) : "No description provided."}</p>
        <div className="mt-5 rounded-xl bg-slate-50 p-3">
          {type === "retainer" && !isDeliveryTeam ? <div className="grid grid-cols-2 gap-3"><div><p className="text-xs text-slate-500">Available this month</p><p className="mt-1 text-sm font-semibold">{remainingHours.toFixed(1)}h</p>{rolloverHours > 0 && <p className="mt-1 text-[10px] text-emerald-600">Includes {rolloverHours.toFixed(1)}h rollover</p>}</div><div><p className="text-xs text-slate-500">Monthly usage</p><p className="mt-1 text-sm font-semibold">{usedThisMonth.toFixed(1)}h / {baseHours.toFixed(1)}h renewed</p></div></div> : <div className="grid grid-cols-2 gap-3"><div><p className="text-xs text-slate-500">Active work</p><p className="mt-1 text-sm font-semibold">{count.active} tickets</p></div><div><p className="text-xs text-slate-500">Completed</p><p className="mt-1 text-sm font-semibold">{count.completed} of {count.total}</p></div></div>}
          {showRates && project.hourly_rate !== null && <p className="mt-3 border-t border-stone-200 pt-3 text-xs text-slate-500">{dollars(Number(project.hourly_rate))}/hour · USD</p>}
        </div>
        <div className="mt-4 flex items-center gap-2 border-t border-stone-100 pt-4 text-xs text-slate-500"><CalendarDays aria-hidden="true" className="size-3.5" /><span>{sprintLabel}</span></div>
      </Link>;
    })}</div>;
  }

  return (
    <main className="min-h-svh bg-[#f6f3ee] text-slate-950">
      <AppHeader />
      <div className="mx-auto max-w-6xl px-5 py-10 sm:px-8 sm:py-14">
        <div className="border-b border-black/10 pb-8 sm:flex sm:items-end sm:justify-between"><div><p className="eyebrow">{isClient ? "Your client workspace" : isManagement ? "Delivery portfolio" : "Assigned workspaces"}</p><h1 className="mt-3 text-5xl leading-none sm:text-6xl">Projects</h1></div><div className="mt-5 flex flex-col items-start gap-4 sm:mt-0 sm:items-end"><p className="max-w-md text-sm leading-6 text-slate-600 sm:text-right">{isClient ? "Follow delivery, project health, and the capacity available for new requests." : isManagement ? "Manage commercial details, monthly retainer capacity, delivery health, and access." : "Open your assigned projects to review delivery priorities, sprint dates, and active work."}</p>{role === "admin" && <ProjectComposer users={memberOptions} />}</div></div>
        <section aria-labelledby="retainers-heading" className="mt-10"><div className="mb-4 flex items-end justify-between"><div><p className="eyebrow">Recurring partnerships</p><h2 className="font-display mt-2 text-3xl" id="retainers-heading">Retainers</h2></div><span className="text-sm text-slate-500">{retainers.length}</span></div>{projectGrid(retainers, "retainer")}</section>
        <section aria-labelledby="new-builds-heading" className="mt-12"><div className="mb-4 flex items-end justify-between"><div><p className="eyebrow">Defined engagements</p><h2 className="font-display mt-2 text-3xl" id="new-builds-heading">New builds</h2></div><span className="text-sm text-slate-500">{newBuilds.length}</span></div>{projectGrid(newBuilds, "new_build")}</section>
      </div>
    </main>
  );
}
