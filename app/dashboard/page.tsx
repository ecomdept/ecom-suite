import Link from "next/link";
import { ArrowUpRight, CalendarDays, CircleUserRound, FolderKanban, ListChecks, ShieldCheck, Sparkles, UserPlus } from "lucide-react";
import { AppHeader } from "@/components/app-header";
import { InviteUserForm } from "@/components/dashboard/invite-user-form";
import { AdminUserList } from "@/components/dashboard/admin-user-list";
import { requireUser } from "@/lib/auth/session";
import { isAppRole, ROLE_LABELS } from "@/lib/auth/roles";

export const metadata = { title: "Dashboard" };
export const instant = false;

function stringClaim(value: unknown) {
  return typeof value === "string" ? value : "";
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

  return (
    <main className="min-h-svh bg-[#f6f3ee] text-slate-950">
      <AppHeader />
      <div className="mx-auto max-w-6xl px-5 py-10 sm:px-8 sm:py-14">
        <section className="relative overflow-hidden rounded-[2rem] bg-[#171717] px-6 py-8 text-white shadow-[0_24px_70px_rgba(23,23,23,0.16)] sm:px-9 sm:py-10">
          <div className="absolute -right-16 -top-28 size-72 rounded-full bg-[#f00073] opacity-20 blur-[90px]" />
          <div className="relative flex flex-col justify-between gap-7 sm:flex-row sm:items-end">
          <div>
            <p className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.2em] text-[#ff64ad]"><Sparkles aria-hidden="true" className="size-4" />Your workroom</p>
            <h1 className="mt-4 text-4xl leading-none sm:text-6xl">Welcome, {firstName}.</h1>
            <p className="mt-4 max-w-xl text-sm leading-6 text-white/55">A focused view of your projects, requests, conversations, and delivery.</p>
          </div>
          <div className="flex items-center gap-2 rounded-full border border-white/10 bg-white/[0.06] px-4 py-2 text-xs text-white/65">
            {role === "admin" ? <ShieldCheck aria-hidden="true" className="size-4 text-[#f00073]" /> : <CalendarDays aria-hidden="true" className="size-4" />}
            {role ? ROLE_LABELS[role] : "Role pending"}
          </div>
          </div>
        </section>

        <section aria-label="Workspace shortcuts" className={`mt-8 grid gap-4 ${role === "client" ? "sm:grid-cols-1" : "sm:grid-cols-2"}`}>
          <Link className="group flex items-center justify-between rounded-2xl border border-stone-200 bg-white p-5 shadow-sm transition hover:-translate-y-0.5 hover:border-stone-300 hover:shadow-md" href="/projects">
            <span className="flex items-center gap-4"><span className="grid size-11 place-items-center rounded-xl bg-pink-50 text-pink-600"><FolderKanban aria-hidden="true" className="size-5" /></span><span><span className="block font-semibold">{role === "client" ? "Your projects" : "Project workspace"}</span><span className="mt-0.5 block text-sm text-slate-500">{role === "client" ? "Submit requests and follow delivery." : "Plan, deliver, and manage project work."}</span></span></span><ArrowUpRight aria-hidden="true" className="size-5 text-slate-300 transition group-hover:text-pink-500" />
          </Link>
          {role !== "client" && <Link className="group flex items-center justify-between rounded-2xl border border-stone-200 bg-white p-5 shadow-sm transition hover:-translate-y-0.5 hover:border-stone-300 hover:shadow-md" href="/my-tasks"><span className="flex items-center gap-4"><span className="grid size-11 place-items-center rounded-xl bg-stone-100 text-slate-700"><ListChecks aria-hidden="true" className="size-5" /></span><span><span className="block font-semibold">My tasks</span><span className="mt-0.5 block text-sm text-slate-500">See assignments, capacity, and due dates.</span></span></span><ArrowUpRight aria-hidden="true" className="size-5 text-slate-300 transition group-hover:text-pink-500" /></Link>}
        </section>

        {role === "admin" && (
          <>
            <section aria-labelledby="invite-heading" className="mt-10 overflow-hidden rounded-2xl border border-stone-200 bg-white shadow-sm">
              <div className="flex items-start gap-3 border-b border-stone-100 px-5 py-5 sm:px-7">
                <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-pink-50 text-pink-600"><UserPlus aria-hidden="true" className="size-5" /></span>
                <div>
                  <h2 className="text-lg font-semibold" id="invite-heading">Invite a team member</h2>
                  <p className="mt-1 text-sm text-slate-500">Assign their role now. They’ll receive a secure email to create their password.</p>
                </div>
              </div>
              <div className="p-5 sm:p-7"><InviteUserForm /></div>
            </section>
            <AdminUserList />
          </>
        )}

        <section aria-labelledby="profile-heading" className="mt-10 overflow-hidden rounded-2xl border border-stone-200 bg-white shadow-sm">
          <div className="border-b border-stone-100 px-5 py-5 sm:px-7">
            <h2 className="text-lg font-semibold" id="profile-heading">Your profile</h2>
            <p className="mt-1 text-sm text-slate-500">The identity associated with this workspace.</p>
          </div>
          <div className="grid gap-6 p-5 sm:grid-cols-[auto_1fr] sm:p-7">
            <span className="grid size-14 place-items-center rounded-2xl bg-pink-50 text-pink-600"><CircleUserRound aria-hidden="true" className="size-7" /></span>
            <dl className="grid gap-5 sm:grid-cols-3">
              <div><dt className="text-xs font-semibold uppercase tracking-wider text-slate-400">Full name</dt><dd className="mt-1.5 font-medium">{fullName}</dd></div>
              <div><dt className="text-xs font-semibold uppercase tracking-wider text-slate-400">Email</dt><dd className="mt-1.5 break-all font-medium">{email}</dd></div>
              <div><dt className="text-xs font-semibold uppercase tracking-wider text-slate-400">Role</dt><dd className="mt-1.5 font-medium">{role ? ROLE_LABELS[role] : "Not assigned"}</dd></div>
            </dl>
          </div>
        </section>
      </div>
    </main>
  );
}
