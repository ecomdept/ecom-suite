import { notFound } from "next/navigation";
import { AlertTriangle, Banknote, ChartNoAxesCombined, ClockArrowUp, Percent, TrendingUp } from "lucide-react";
import { AppHeader } from "@/components/app-header";
import { MonthlyTrendCharts } from "@/components/analytics/sprint-trend-charts";
import { TeamCostRates } from "@/components/analytics/team-cost-rates";
import { requireUser } from "@/lib/auth/session";
import { ROLE_LABELS, isAppRole } from "@/lib/auth/roles";
import { getMonthWindow, getRecentMonthWindows } from "@/lib/projects/months";
import { createAdminClient } from "@/lib/supabase/admin";

export const metadata = { title: "Agency analytics" };
export const instant = false;

const money = (value: number) => new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(value);

export default async function AnalyticsPage() {
  const { supabase, claims } = await requireUser();
  const userId = typeof claims.sub === "string" ? claims.sub : "";
  const { data: roleRecord } = await supabase.from("user_roles").select("role").eq("user_id", userId).maybeSingle();
  if (roleRecord?.role !== "admin") notFound();

  const [{ data: projects }, { data: costRates }] = await Promise.all([
    supabase.from("projects").select("id, name, created_at, project_type, retainer_hours, hourly_rate, status, risk, rollover_enabled, rollover_cap_hours").order("name"),
    supabase.from("team_cost_rates").select("user_id, hourly_cost"),
  ]);
  const projectRows = (projects ?? []) as Array<{ id: string; name: string; created_at: string; project_type: "retainer" | "new_build"; retainer_hours: number | null; hourly_rate: number | null; status: "active" | "on_hold" | "completed"; risk: "on_track" | "at_risk" | "off_track"; rollover_enabled: boolean; rollover_cap_hours: number | null }>;
  const currentMonth = getMonthWindow();
  const previousMonth = getMonthWindow(new Date(), -1);
  const trendWindows = getRecentMonthWindows(6);
  const { data: timeEntries } = projectRows.length
    ? await supabase.from("ticket_time_entries").select("project_id, worker_id, hours, work_date").in("project_id", projectRows.map((project) => project.id)).gte("work_date", trendWindows[0].start).lt("work_date", trendWindows.at(-1)?.endExclusive)
    : { data: [] };
  const entries = (timeEntries ?? []).map((entry) => ({ ...entry, date: entry.work_date, hours: Number(entry.hours) }));
  const costByUser = new Map((costRates ?? []).map((rate) => [rate.user_id, Number(rate.hourly_cost)]));

  function entryCost(entry: (typeof entries)[number]) {
    return entry.hours * (entry.worker_id ? costByUser.get(entry.worker_id) ?? 0 : 0);
  }

  const projectMetrics = projectRows.map((project) => {
    const currentEntries = entries.filter((entry) => entry.project_id === project.id && entry.date >= currentMonth.start && entry.date < currentMonth.endExclusive);
    const previousHours = entries.filter((entry) => entry.project_id === project.id && entry.date >= previousMonth.start && entry.date < previousMonth.endExclusive).reduce((total, entry) => total + entry.hours, 0);
    const usedHours = Math.max(0, currentEntries.reduce((total, entry) => total + entry.hours, 0));
    const baseHours = Number(project.retainer_hours ?? 0);
    const unusedPrevious = Math.max(0, baseHours - Math.max(0, previousHours));
    const rolloverHours = project.project_type === "retainer" && project.rollover_enabled
      ? Math.min(unusedPrevious, project.rollover_cap_hours === null ? unusedPrevious : Number(project.rollover_cap_hours))
      : 0;
    const revenue = project.project_type === "retainer" ? baseHours * Number(project.hourly_rate ?? 0) : usedHours * Number(project.hourly_rate ?? 0);
    const cost = currentEntries.reduce((total, entry) => total + entryCost(entry), 0);
    return { ...project, usedHours, rolloverHours, availableHours: Math.max(0, baseHours + rolloverHours - usedHours), revenue, cost, profit: revenue - cost };
  });

  const activeMetrics = projectMetrics.filter((project) => project.status !== "completed");
  const totalRevenue = activeMetrics.reduce((total, project) => total + project.revenue, 0);
  const totalCost = activeMetrics.reduce((total, project) => total + project.cost, 0);
  const grossProfit = totalRevenue - totalCost;
  const margin = totalRevenue > 0 ? (grossProfit / totalRevenue) * 100 : 0;
  const unusedHours = activeMetrics.filter((project) => project.project_type === "retainer").reduce((total, project) => total + Math.max(0, Number(project.retainer_hours ?? 0) - project.usedHours), 0);
  const rolloverHours = activeMetrics.reduce((total, project) => total + project.rolloverHours, 0);

  const trends = trendWindows.map((window) => {
    const windowEntries = entries.filter((entry) => entry.date >= window.start && entry.date < window.endExclusive);
    let revenue = 0;
    let usedHours = 0;
    let unused = 0;
    let rollover = 0;
    projectRows.forEach((project) => {
      if (project.created_at.slice(0, 10) >= window.endExclusive) return;
      const projectEntries = windowEntries.filter((entry) => entry.project_id === project.id);
      const projectHours = Math.max(0, projectEntries.reduce((total, entry) => total + entry.hours, 0));
      if (project.project_type === "retainer") {
        const capacity = Number(project.retainer_hours ?? 0);
        revenue += capacity * Number(project.hourly_rate ?? 0);
        usedHours += projectHours;
        const projectUnused = Math.max(0, capacity - projectHours);
        unused += projectUnused;
        if (project.rollover_enabled) rollover += Math.min(projectUnused, project.rollover_cap_hours === null ? projectUnused : Number(project.rollover_cap_hours));
      } else {
        revenue += projectHours * Number(project.hourly_rate ?? 0);
      }
    });
    const cost = windowEntries.reduce((total, entry) => total + entryCost(entry), 0);
    return { label: window.shortLabel, revenue, cost, profit: revenue - cost, usedHours, unusedHours: unused, rolloverHours: rollover };
  });

  const unknownCostWorkers = new Set(entries.filter((entry) => entry.worker_id && !costByUser.has(entry.worker_id)).map((entry) => entry.worker_id)).size;
  let teamMembers: Array<{ id: string; name: string; role: string; hourlyCost: number | null }> = [];
  try {
    const adminClient = createAdminClient();
    const [{ data: authData }, { data: profiles }, { data: roles }] = await Promise.all([
      adminClient.auth.admin.listUsers({ page: 1, perPage: 1000 }),
      adminClient.from("profiles").select("id, full_name"),
      adminClient.from("user_roles").select("user_id, role"),
    ]);
    const profileById = new Map(profiles?.map((profile) => [profile.id, profile.full_name]));
    const roleById = new Map(roles?.map((role) => [role.user_id, role.role]));
    teamMembers = (authData?.users ?? []).flatMap((user) => {
      const role = roleById.get(user.id);
      if (!role || !isAppRole(role) || role === "client") return [];
      return [{ id: user.id, name: profileById.get(user.id) || (typeof user.user_metadata?.full_name === "string" ? user.user_metadata.full_name : "") || user.email?.split("@")[0] || "Unknown user", role: ROLE_LABELS[role], hourlyCost: costByUser.get(user.id) ?? null }];
    });
  } catch {
    teamMembers = [];
  }

  return (
    <main className="min-h-svh bg-[#f6f3ee] text-slate-950">
      <AppHeader />
      <div className="mx-auto max-w-[1500px] px-5 py-10 sm:px-8 sm:py-14">
        <header className="relative overflow-hidden rounded-[2rem] bg-[#171717] px-6 py-8 text-white shadow-[0_24px_70px_rgba(23,23,23,.16)] sm:px-9 sm:py-11"><div className="absolute -right-20 -top-32 size-80 rounded-full bg-[#f00073] opacity-20 blur-[100px]" /><div className="relative"><p className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.2em] text-[#ff64ad]"><ChartNoAxesCombined aria-hidden="true" className="size-4" />Admin only</p><h1 className="mt-4 text-5xl leading-none sm:text-6xl">Agency analytics</h1><p className="mt-4 max-w-2xl text-sm leading-6 text-white/55">Commercial performance and monthly retainer utilization—not day-to-day task management. Current reporting month: {currentMonth.label}.</p></div></header>

        {unknownCostWorkers > 0 && <div className="mt-6 flex items-start gap-3 rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900"><AlertTriangle aria-hidden="true" className="mt-0.5 size-4 shrink-0" /><p>{unknownCostWorkers} contributor{unknownCostWorkers === 1 ? " has" : "s have"} logged time without an internal cost rate. Profit is currently overstated until those rates are configured below.</p></div>}

        <section aria-label="Current month financial summary" className="mt-8 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {[{ label: "Recognized revenue", value: money(totalRevenue), detail: "Retainer commitment plus hourly build work", icon: Banknote, color: "bg-pink-600" }, { label: "Delivery cost", value: money(totalCost), detail: "Logged hours × internal team cost", icon: ClockArrowUp, color: "bg-slate-700" }, { label: "Estimated gross profit", value: money(grossProfit), detail: "Revenue less direct labor cost", icon: TrendingUp, color: grossProfit >= 0 ? "bg-emerald-600" : "bg-red-600" }, { label: "Gross margin", value: `${margin.toFixed(1)}%`, detail: "Before overhead and non-labor expenses", icon: Percent, color: "bg-violet-600" }].map((card, index) => <article className={`rounded-2xl border p-5 shadow-sm ${index === 0 ? "border-[#171717] bg-[#171717] text-white" : "border-stone-200 bg-white"}`} key={card.label}><span className={`grid size-10 place-items-center rounded-xl text-white ${card.color}`}><card.icon aria-hidden="true" className="size-5" /></span><p className={`mt-5 text-sm ${index === 0 ? "text-white/50" : "text-slate-500"}`}>{card.label}</p><p className="mt-1 text-3xl font-semibold">{card.value}</p><p className={`mt-3 text-xs ${index === 0 ? "text-white/40" : "text-slate-500"}`}>{card.detail}</p></article>)}
        </section>

        <div className="mt-8"><MonthlyTrendCharts trends={trends} /></div>

        <section className="mt-8 overflow-hidden rounded-2xl border border-stone-200 bg-white shadow-sm" aria-labelledby="portfolio-profitability-heading">
          <div className="flex flex-wrap items-end justify-between gap-4 px-5 py-5 sm:px-7"><div><h2 className="font-semibold" id="portfolio-profitability-heading">Current-month profitability</h2><p className="mt-1 text-sm text-slate-500">Commercial health by active engagement.</p></div><div className="flex gap-4 text-xs text-slate-500"><span>{unusedHours.toFixed(1)}h unused</span><span>{rolloverHours.toFixed(1)}h eligible rollover</span></div></div>
          <div className="overflow-x-auto"><table className="w-full min-w-[820px] text-left text-sm"><thead className="border-y border-stone-100 bg-stone-50 text-xs uppercase tracking-wide text-slate-400"><tr><th className="px-7 py-3">Project</th><th className="px-4 py-3">Used / available</th><th className="px-4 py-3">Rollover</th><th className="px-4 py-3">Revenue</th><th className="px-4 py-3">Cost</th><th className="px-7 py-3 text-right">Gross profit</th></tr></thead><tbody className="divide-y divide-stone-100">{activeMetrics.map((project) => <tr key={project.id}><td className="px-7 py-4"><p className="font-semibold">{project.name}</p><p className="mt-1 text-xs capitalize text-slate-500">{project.project_type.replace("_", " ")} · {project.risk.replace("_", " ")}</p></td><td className="px-4 py-4">{project.usedHours.toFixed(1)}h / {project.project_type === "retainer" ? `${project.availableHours.toFixed(1)}h left` : "hourly"}</td><td className="px-4 py-4">{project.project_type === "retainer" ? `${project.rolloverHours.toFixed(1)}h` : "—"}</td><td className="px-4 py-4">{money(project.revenue)}</td><td className="px-4 py-4">{money(project.cost)}</td><td className={`px-7 py-4 text-right font-semibold ${project.profit < 0 ? "text-red-600" : "text-emerald-700"}`}>{money(project.profit)}</td></tr>)}{!activeMetrics.length && <tr><td className="px-7 py-10 text-center text-slate-500" colSpan={6}>No active projects are available.</td></tr>}</tbody></table></div>
        </section>

        <div className="mt-8"><TeamCostRates members={teamMembers} /></div>
        <p className="mt-5 text-xs leading-5 text-slate-500">Profit is an operational estimate: monthly retainer revenue is recognized from contracted monthly hours at the project hourly rate; new-build revenue is recognized from logged hours. Labor cost uses the internal rates above. Overhead, taxes, discounts, invoices, and external expenses are not included.</p>
      </div>
    </main>
  );
}
