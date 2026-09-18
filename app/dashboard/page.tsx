import { CalendarDays, CircleUserRound, Layers3, Sparkles } from "lucide-react";
import { LogoutButton } from "@/components/logout-button";
import { requireUser } from "@/lib/auth/session";

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
  const { data: profile } = userId
    ? await supabase.from("profiles").select("full_name").eq("id", userId).maybeSingle()
    : { data: null };
  const fullName = profile?.full_name || metadataName || email.split("@")[0] || "there";
  const firstName = fullName.split(" ")[0];

  return (
    <main className="min-h-svh bg-slate-50 text-slate-950">
      <header className="border-b border-slate-200 bg-white">
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-5 sm:px-8">
          <div className="flex items-center gap-3 font-semibold">
            <span className="grid size-9 place-items-center rounded-xl bg-indigo-600 text-white"><Layers3 aria-hidden="true" className="size-4" /></span>
            Orbit
          </div>
          <LogoutButton />
        </div>
      </header>
      <div className="mx-auto max-w-6xl px-5 py-10 sm:px-8 sm:py-14">
        <div className="flex flex-col justify-between gap-5 sm:flex-row sm:items-end">
          <div>
            <p className="flex items-center gap-2 text-sm font-medium text-indigo-600"><Sparkles aria-hidden="true" className="size-4" />Your workspace</p>
            <h1 className="mt-2 text-3xl font-semibold tracking-tight sm:text-4xl">Welcome, {firstName}</h1>
            <p className="mt-2 text-slate-600">Your account is ready. Project tools are coming next.</p>
          </div>
          <div className="flex items-center gap-2 text-sm text-slate-500"><CalendarDays aria-hidden="true" className="size-4" />Account overview</div>
        </div>
        <section aria-labelledby="profile-heading" className="mt-10 overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
          <div className="border-b border-slate-100 px-5 py-5 sm:px-7">
            <h2 className="text-lg font-semibold" id="profile-heading">Your profile</h2>
            <p className="mt-1 text-sm text-slate-500">The identity associated with this workspace.</p>
          </div>
          <div className="grid gap-6 p-5 sm:grid-cols-[auto_1fr] sm:p-7">
            <span className="grid size-14 place-items-center rounded-2xl bg-indigo-50 text-indigo-600"><CircleUserRound aria-hidden="true" className="size-7" /></span>
            <dl className="grid gap-5 sm:grid-cols-2">
              <div><dt className="text-xs font-semibold uppercase tracking-wider text-slate-400">Full name</dt><dd className="mt-1.5 font-medium">{fullName}</dd></div>
              <div><dt className="text-xs font-semibold uppercase tracking-wider text-slate-400">Email</dt><dd className="mt-1.5 break-all font-medium">{email}</dd></div>
            </dl>
          </div>
        </section>
      </div>
    </main>
  );
}
