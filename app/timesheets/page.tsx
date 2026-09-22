import { notFound } from "next/navigation";
import { CalendarDays, Clock3, Users } from "lucide-react";
import { AppHeader } from "@/components/app-header";
import { TimesheetEntryRow, type TimesheetEntryView } from "@/components/timesheets/timesheet-entry-row";
import { Button } from "@/components/ui/button";
import { DatePicker } from "@/components/ui/date-picker";
import { Label } from "@/components/ui/label";
import { requireUser } from "@/lib/auth/session";
import { isAppRole, ROLE_LABELS } from "@/lib/auth/roles";
import { isUuid } from "@/lib/projects/validation";
import { createAdminClient } from "@/lib/supabase/admin";

export const metadata = { title: "Timesheets" };
export const instant = false;

function validDate(value: string | undefined) {
  if (!value || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const parsed = new Date(`${value}T00:00:00.000Z`);
  return !Number.isNaN(parsed.getTime()) && parsed.toISOString().slice(0, 10) === value;
}

export default async function TimesheetsPage({ searchParams }: { searchParams: Promise<{ user?: string; from?: string; to?: string }> }) {
  const query = await searchParams;
  const { supabase, claims } = await requireUser();
  const userId = typeof claims.sub === "string" ? claims.sub : "";
  const { data: roleRecord } = await supabase.from("user_roles").select("role").eq("user_id", userId).maybeSingle();
  const role = roleRecord?.role;
  if (!role || role === "client") notFound();
  const canViewAll = role === "admin" || role === "project_manager";

  const today = new Date();
  const defaultTo = today.toISOString().slice(0, 10);
  const defaultFrom = new Date(today.getTime() - 13 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
  const from = validDate(query.from) ? query.from! : defaultFrom;
  const to = validDate(query.to) ? query.to! : defaultTo;
  const selectedUserId = canViewAll && query.user && isUuid(query.user) ? query.user : canViewAll ? null : userId;
  const dataClient = canViewAll ? createAdminClient() : supabase;

  let entriesQuery = dataClient.from("ticket_time_entries").select("id, project_id, ticket_id, subtask_id, worker_id, work_date, hours, created_at").gte("work_date", from).lte("work_date", to).order("work_date", { ascending: false }).order("created_at", { ascending: false }).limit(500);
  if (selectedUserId) entriesQuery = entriesQuery.eq("worker_id", selectedUserId);
  const { data: entryRows } = await entriesQuery;
  const entries = entryRows ?? [];
  const ticketIds = [...new Set(entries.map((entry) => entry.ticket_id))];
  const projectIds = [...new Set(entries.map((entry) => entry.project_id))];
  const subtaskIds = [...new Set(entries.map((entry) => entry.subtask_id).filter((id): id is string => typeof id === "string"))];
  const workerIds = [...new Set(entries.map((entry) => entry.worker_id).filter((id): id is string => typeof id === "string"))];

  const [{ data: tickets }, { data: projects }, { data: subtasks }] = await Promise.all([
    ticketIds.length ? dataClient.from("tickets").select("id, title").in("id", ticketIds) : Promise.resolve({ data: [] }),
    projectIds.length ? dataClient.from("projects").select("id, name").in("id", projectIds) : Promise.resolve({ data: [] }),
    subtaskIds.length ? dataClient.from("ticket_subtasks").select("id, title").in("id", subtaskIds) : Promise.resolve({ data: [] }),
  ]);
  const ticketNames = new Map((tickets ?? []).map((ticket) => [ticket.id, ticket.title]));
  const projectNames = new Map((projects ?? []).map((project) => [project.id, project.name]));
  const subtaskNames = new Map((subtasks ?? []).map((subtask) => [subtask.id, subtask.title]));

  let userOptions: Array<{ id: string; name: string; role: string }> = [];
  const userNames = new Map<string, string>();
  if (canViewAll) {
    const adminClient = createAdminClient();
    const [{ data: authData }, { data: profiles }, { data: roles }] = await Promise.all([
      adminClient.auth.admin.listUsers({ page: 1, perPage: 1000 }),
      adminClient.from("profiles").select("id, full_name"),
      adminClient.from("user_roles").select("user_id, role"),
    ]);
    const names = new Map(profiles?.map((profile) => [profile.id, profile.full_name]));
    const roleById = new Map(roles?.map((userRole) => [userRole.user_id, userRole.role]));
    userOptions = (authData?.users ?? []).flatMap((user) => {
      const userRole = roleById.get(user.id);
      if (!userRole || !isAppRole(userRole) || userRole === "client") return [];
      const name = names.get(user.id) || (typeof user.user_metadata?.full_name === "string" ? user.user_metadata.full_name : "") || user.email?.split("@")[0] || "Unknown user";
      userNames.set(user.id, name);
      return [{ id: user.id, name, role: ROLE_LABELS[userRole] }];
    });
  } else {
    const { data: profile } = await supabase.from("profiles").select("full_name").eq("id", userId).maybeSingle();
    userNames.set(userId, profile?.full_name || (typeof claims.email === "string" ? claims.email.split("@")[0] : "You"));
  }
  workerIds.forEach((workerId) => { if (!userNames.has(workerId)) userNames.set(workerId, `Team member ${workerId.slice(0, 8)}`); });

  const viewEntries: TimesheetEntryView[] = entries.map((entry) => ({
    id: entry.id,
    projectId: entry.project_id,
    ticketId: entry.ticket_id,
    taskTitle: ticketNames.get(entry.ticket_id) ?? "Deleted task",
    subtaskTitle: entry.subtask_id ? subtaskNames.get(entry.subtask_id) ?? "Deleted subtask" : null,
    projectName: projectNames.get(entry.project_id) ?? "Deleted project",
    personName: entry.worker_id ? userNames.get(entry.worker_id) ?? "Unknown team member" : "Unassigned",
    workDate: entry.work_date,
    hours: Number(entry.hours),
    canEdit: role === "admin" || entry.worker_id === userId,
    canOpenTask: role === "admin" || entry.worker_id === userId,
  }));
  const totalHours = viewEntries.reduce((total, entry) => total + entry.hours, 0);
  const dailyTotals = new Map<string, { date: string; person: string; hours: number }>();
  viewEntries.forEach((entry) => {
    const key = `${entry.personName}:${entry.workDate}`;
    const current = dailyTotals.get(key) ?? { date: entry.workDate, person: entry.personName, hours: 0 };
    current.hours += entry.hours;
    dailyTotals.set(key, current);
  });
  const overloadedDays = [...dailyTotals.values()].filter((day) => day.hours > 7);

  return (
    <main className="min-h-svh bg-[#f6f3ee] text-slate-950">
      <AppHeader />
      <div className="mx-auto max-w-6xl px-5 py-10 sm:px-8 sm:py-14">
        <header className="border-b border-black/10 pb-8 sm:flex sm:items-end sm:justify-between"><div><p className="eyebrow">{canViewAll ? "Team reporting" : "Your recorded work"}</p><h1 className="mt-3 text-5xl leading-none sm:text-6xl">Timesheets</h1><p className="mt-4 max-w-xl text-sm leading-6 text-slate-600">{canViewAll ? "Review recorded delivery time across the agency. Team members retain control of their own entries; admins can correct any entry." : "Review the time attributed to your tickets and correct the hours or work date when needed."}</p></div><div className="mt-6 grid grid-cols-2 gap-3 sm:mt-0"><div className="rounded-xl bg-[#171717] px-4 py-3 text-white"><p className="text-xs text-white/50">Period total</p><p className="mt-1 text-2xl font-semibold">{totalHours.toFixed(2)}h</p></div><div className={`rounded-xl px-4 py-3 ${overloadedDays.length ? "bg-red-50 text-red-700" : "bg-emerald-50 text-emerald-700"}`}><p className="text-xs opacity-70">Over 7h days</p><p className="mt-1 text-2xl font-semibold">{overloadedDays.length}</p></div></div></header>

        <form className="mt-8 grid gap-4 rounded-2xl border border-stone-200 bg-white p-5 shadow-sm sm:grid-cols-2 lg:grid-cols-[minmax(0,1fr)_180px_180px_auto] lg:items-end" method="get">
          {canViewAll ? <div className="space-y-2"><Label htmlFor="timesheet-user">Team member</Label><select className="flex h-10 w-full rounded-md border border-input bg-white px-3 text-sm" defaultValue={selectedUserId ?? ""} id="timesheet-user" name="user"><option value="">All agency users</option>{userOptions.map((user) => <option key={user.id} value={user.id}>{user.name} · {user.role}</option>)}</select></div> : <div className="flex items-center gap-3 rounded-xl bg-stone-50 px-4 py-3"><Users aria-hidden="true" className="size-4 text-pink-600" /><div><p className="text-xs text-slate-500">Showing</p><p className="text-sm font-semibold">My entries only</p></div></div>}
          <div className="space-y-2"><Label htmlFor="timesheet-from">From</Label><DatePicker defaultValue={from} id="timesheet-from" name="from" /></div>
          <div className="space-y-2"><Label htmlFor="timesheet-to">To</Label><DatePicker defaultValue={to} id="timesheet-to" name="to" /></div>
          <Button type="submit" variant="outline"><CalendarDays aria-hidden="true" />Apply filters</Button>
        </form>

        {overloadedDays.length > 0 && <section className="mt-6 rounded-xl border border-red-200 bg-red-50 p-4" aria-label="Daily capacity warnings"><h2 className="flex items-center gap-2 text-sm font-semibold text-red-800"><Clock3 aria-hidden="true" className="size-4" />Daily capacity warning</h2><div className="mt-2 flex flex-wrap gap-2">{overloadedDays.map((day) => <span className="rounded-full bg-white px-3 py-1 text-xs font-medium text-red-700" key={`${day.person}-${day.date}`}>{canViewAll ? `${day.person} · ` : ""}{day.date}: {day.hours.toFixed(2)}h</span>)}</div></section>}

        <section className="mt-8 overflow-visible rounded-2xl border border-stone-200 bg-white shadow-sm" aria-labelledby="timesheet-list-heading"><div className="grid gap-2 border-b border-stone-100 px-5 py-5 sm:px-7 lg:grid-cols-[minmax(0,1fr)_150px_100px_auto]"><div><h2 className="font-semibold" id="timesheet-list-heading">Time entries</h2><p className="mt-1 text-xs text-slate-500">Up to 500 entries in the selected period.</p></div><span className="hidden text-xs font-semibold uppercase tracking-wide text-slate-400 lg:block">Date</span><span className="hidden text-xs font-semibold uppercase tracking-wide text-slate-400 lg:block">Time</span><span className="hidden text-xs font-semibold uppercase tracking-wide text-slate-400 lg:block">Actions</span></div><div className="divide-y divide-stone-100">{viewEntries.length ? viewEntries.map((entry) => <TimesheetEntryRow entry={entry} key={entry.id} showPerson={canViewAll} />) : <div className="px-6 py-14 text-center"><Clock3 aria-hidden="true" className="mx-auto size-9 text-slate-300" /><h3 className="mt-4 font-semibold">No time recorded</h3><p className="mt-1 text-sm text-slate-500">No entries match the selected person and date range.</p></div>}</div></section>
      </div>
    </main>
  );
}
