import { Banknote, CheckCircle2, Clock3, ListTodo } from "lucide-react";

function percent(used: number, total: number | null) {
  if (!total || total <= 0) return 0;
  return Math.min(100, Math.round((used / total) * 100));
}

function money(value: number, currency: string) {
  try {
    return new Intl.NumberFormat("en-US", { style: "currency", currency, maximumFractionDigits: 0 }).format(value);
  } catch {
    return `${currency} ${value.toLocaleString()}`;
  }
}

export function ProjectAnalytics({ retainerHours, budgetAmount, currency, estimatedHours, loggedHours, billableAmount, activeTickets, completedTickets, periodLabel, audience }: { retainerHours: number | null; budgetAmount: number | null; currency: string; estimatedHours: number; loggedHours: number; billableAmount: number; activeTickets: number; completedTickets: number; periodLabel?: string; audience: "client" | "manager" | "contributor" }) {
  const remainingHours = retainerHours === null ? null : Math.max(0, retainerHours - loggedHours);
  const remainingBudget = budgetAmount === null ? null : Math.max(0, budgetAmount - billableAmount);
  const financialCards = [
    { label: "Retainer available", value: remainingHours === null ? "Not set" : `${remainingHours.toFixed(1)}h`, detail: retainerHours === null ? "Configure a retainer" : `${loggedHours.toFixed(1)} of ${retainerHours.toFixed(1)} hours used`, progress: percent(loggedHours, retainerHours), icon: Clock3, color: "text-pink-600 bg-pink-50" },
    { label: "Budget available", value: remainingBudget === null ? "Not set" : money(remainingBudget, currency), detail: budgetAmount === null ? "Configure a budget" : `${money(billableAmount, currency)} of ${money(budgetAmount, currency)} used`, progress: percent(billableAmount, budgetAmount), icon: Banknote, color: "text-emerald-600 bg-emerald-50" },
    { label: "Active requests", value: String(activeTickets), detail: "Across backlog and in progress", progress: null, icon: ListTodo, color: "text-blue-600 bg-blue-50" },
    { label: "Completed", value: String(completedTickets), detail: "Delivered tickets", progress: null, icon: CheckCircle2, color: "text-violet-600 bg-violet-50" },
  ];
  const contributorCards = [
    { label: "Active work", value: String(activeTickets), detail: "Across backlog and in progress", progress: null, icon: ListTodo, color: "text-blue-600 bg-blue-50" },
    { label: "Completed", value: String(completedTickets), detail: "Delivered tickets", progress: null, icon: CheckCircle2, color: "text-emerald-600 bg-emerald-50" },
    { label: "Estimated", value: `${estimatedHours.toFixed(1)}h`, detail: "Planned across visible tickets", progress: null, icon: Clock3, color: "text-violet-600 bg-violet-50" },
    { label: "Logged", value: `${loggedHours.toFixed(1)}h`, detail: "Recorded delivery time", progress: null, icon: Clock3, color: "text-pink-600 bg-pink-50" },
  ];
  const cards = audience === "contributor" ? contributorCards : financialCards;

  return (
    <section aria-labelledby="analytics-heading" className="mt-8">
      <div className="mb-5 flex flex-wrap items-end justify-between gap-2"><div><p className="eyebrow">Project health</p><h2 className="font-display mt-2 text-3xl leading-none" id="analytics-heading">{audience === "contributor" ? "Delivery overview" : "Retainer overview"}</h2></div>{periodLabel && audience !== "contributor" && <p className="rounded-full border border-stone-200 bg-white px-3 py-1.5 text-xs text-slate-500">Current period: {periodLabel}</p>}</div>
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {cards.map((card, index) => <article className={`rounded-2xl border p-5 shadow-[0_1px_2px_rgba(23,23,23,.04)] ${index === 0 ? "border-[#171717] bg-[#171717] text-white" : "border-stone-200 bg-white"}`} key={card.label}><div className="flex items-start justify-between gap-3"><div><p className={`text-sm ${index === 0 ? "text-white/50" : "text-slate-500"}`}>{card.label}</p><p className="mt-2 text-2xl font-semibold tracking-tight">{card.value}</p></div><span className={`grid size-10 place-items-center rounded-xl ${index === 0 ? "bg-[#f00073] text-white" : card.color}`}><card.icon aria-hidden="true" className="size-5" /></span></div><p className={`mt-3 text-xs ${index === 0 ? "text-white/45" : "text-slate-500"}`}>{card.detail}</p>{card.progress !== null && <div className={`mt-4 h-1.5 overflow-hidden rounded-full ${index === 0 ? "bg-white/10" : "bg-stone-100"}`}><div className="h-full rounded-full bg-[#f00073] transition-all" style={{ width: `${card.progress}%` }} /></div>}</article>)}
      </div>
    </section>
  );
}
