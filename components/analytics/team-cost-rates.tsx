"use client";

import { useActionState } from "react";
import { Check, Loader2, Save } from "lucide-react";
import { updateTeamCostRateAction, type CostRateActionState } from "@/app/analytics/actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

type CostRateMember = { id: string; name: string; role: string; hourlyCost: number | null };
const initialState: CostRateActionState = {};

function CostRateRow({ member }: { member: CostRateMember }) {
  const [state, action, pending] = useActionState(updateTeamCostRateAction, initialState);
  return (
    <form action={action} className="grid gap-3 border-t border-stone-100 px-5 py-4 sm:grid-cols-[minmax(0,1fr)_170px_auto] sm:items-end sm:px-7">
      <input name="userId" type="hidden" value={member.id} />
      <div><p className="text-sm font-semibold">{member.name}</p><p className="mt-1 text-xs text-slate-500">{member.role}</p></div>
      <div className="space-y-1.5"><Label className="text-xs" htmlFor={`cost-${member.id}`}>Internal cost / hour</Label><Input defaultValue={member.hourlyCost ?? ""} id={`cost-${member.id}`} min="0" name="hourlyCost" placeholder="0.00" required step="0.01" type="number" /></div>
      <div className="flex items-center gap-2"><Button aria-label={`Save cost rate for ${member.name}`} disabled={pending} size="icon" type="submit" variant="outline">{pending ? <Loader2 aria-hidden="true" className="animate-spin" /> : <Save aria-hidden="true" />}</Button>{state.success && <span className="flex items-center gap-1 text-xs text-emerald-600"><Check aria-hidden="true" className="size-3" />Saved</span>}{state.error && <span className="max-w-36 text-xs text-red-600">{state.error}</span>}</div>
    </form>
  );
}

export function TeamCostRates({ members }: { members: CostRateMember[] }) {
  return (
    <section className="overflow-hidden rounded-2xl border border-stone-200 bg-white shadow-sm">
      <div className="px-5 py-5 sm:px-7"><h2 className="font-semibold">Internal delivery costs</h2><p className="mt-1 text-sm text-slate-500">Private admin-only rates used to estimate labor cost and gross profit. These values never appear in project or client views.</p></div>
      {members.length ? members.map((member) => <CostRateRow key={member.id} member={member} />) : <p className="border-t border-stone-100 px-7 py-8 text-sm text-slate-500">No agency team members found.</p>}
    </section>
  );
}
