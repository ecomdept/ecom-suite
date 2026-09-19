import Link from "next/link";
import { ArrowRight, FolderKanban, FolderPlus } from "lucide-react";
import { AppHeader } from "@/components/app-header";
import {
  CreateProjectForm,
  type ProjectMemberOption,
} from "@/components/projects/create-project-form";
import { requireUser } from "@/lib/auth/session";
import { isAppRole, ROLE_LABELS } from "@/lib/auth/roles";
import { createAdminClient } from "@/lib/supabase/admin";

export const metadata = { title: "Projects" };
export const instant = false;

function formatCurrency(value: number, currency: string) {
  try {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency,
      maximumFractionDigits: 0,
    }).format(value);
  } catch {
    return `${currency} ${value.toLocaleString("en-US", { maximumFractionDigits: 0 })}`;
  }
}

export default async function ProjectsPage() {
  const { supabase, claims } = await requireUser();
  const userId = typeof claims.sub === "string" ? claims.sub : "";
  const [{ data: roleRecord }, { data: projects }] = await Promise.all([
    supabase.from("user_roles").select("role").eq("user_id", userId).maybeSingle(),
    supabase
      .from("projects")
      .select("id, name, description, created_at, retainer_hours, budget_amount, currency")
      .order("created_at", { ascending: false }),
  ]);
  const role = roleRecord?.role;
  const isClient = role === "client";
  const showFinancials = role === "admin" || role === "project_manager" || isClient;
  const projectIds = projects?.map((project) => project.id) ?? [];
  const { data: tickets } = projectIds.length
    ? await supabase
        .from("tickets")
        .select("project_id, status, logged_hours, billable_amount")
        .in("project_id", projectIds)
    : { data: [] };
  const ticketCounts = new Map<
    string,
    { total: number; completed: number; loggedHours: number; billedAmount: number }
  >();

  tickets?.forEach((ticket) => {
    const count = ticketCounts.get(ticket.project_id) ?? {
      total: 0,
      completed: 0,
      loggedHours: 0,
      billedAmount: 0,
    };
    count.total += 1;
    if (ticket.status === "completed") count.completed += 1;
    count.loggedHours += Number(ticket.logged_hours ?? 0);
    count.billedAmount += Number(ticket.billable_amount ?? 0);
    ticketCounts.set(ticket.project_id, count);
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

      memberOptions = (authData?.users ?? [])
        .filter((user) => user.id !== userId)
        .map((user) => {
          const userRole = roleById.get(user.id);
          return {
            id: user.id,
            name: profileById.get(user.id) || (typeof user.user_metadata?.full_name === "string" ? user.user_metadata.full_name : "") || user.email?.split("@")[0] || "Unknown user",
            email: user.email ?? "No email",
            role: userRole && isAppRole(userRole) ? ROLE_LABELS[userRole] : "No role",
          };
        });
    } catch {
      memberOptions = [];
    }
  }

  return (
    <main className="min-h-svh bg-[#f6f3ee] text-slate-950">
      <AppHeader />
      <div className="mx-auto max-w-6xl px-5 py-10 sm:px-8 sm:py-14">
        <div className="border-b border-black/10 pb-8 sm:flex sm:items-end sm:justify-between">
          <div><p className="eyebrow">{isClient ? "Your client workspace" : "Delivery portfolio"}</p><h1 className="mt-3 text-5xl leading-none sm:text-6xl">Projects</h1></div>
          <p className="mt-4 max-w-md text-sm leading-6 text-slate-600 sm:mt-0 sm:text-right">{isClient ? "Submit requests, follow delivery, and understand how your retainer is being used." : "Plan active work, coordinate the delivery team, and keep every request moving."}</p>
        </div>

        {role === "admin" && (
          <section aria-labelledby="create-project-heading" className="mt-10 overflow-hidden rounded-2xl border border-stone-200 bg-white shadow-sm">
            <div className="flex items-start gap-3 border-b border-stone-100 px-5 py-5 sm:px-7">
              <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-pink-50 text-pink-600"><FolderPlus aria-hidden="true" className="size-5" /></span>
              <div><h2 className="text-lg font-semibold" id="create-project-heading">Create a project</h2><p className="mt-1 text-sm text-slate-500">Define the project and choose who should have access.</p></div>
            </div>
            <div className="p-5 sm:p-7"><CreateProjectForm users={memberOptions} /></div>
          </section>
        )}

        <section aria-labelledby="project-list-heading" className="mt-10">
          <div className="mb-4 flex items-center justify-between"><h2 className="text-lg font-semibold" id="project-list-heading">Project list</h2><span className="text-sm text-slate-500">{projects?.length ?? 0} total</span></div>
          {projects?.length ? (
            <div className="grid gap-4 md:grid-cols-2">
              {projects.map((project) => {
                const count = ticketCounts.get(project.id) ?? {
                  total: 0,
                  completed: 0,
                  loggedHours: 0,
                  billedAmount: 0,
                };
                const remainingHours = Math.max(
                  0,
                  Number(project.retainer_hours ?? 0) - count.loggedHours,
                );
                const remainingBudget = Math.max(
                  0,
                  Number(project.budget_amount ?? 0) - count.billedAmount,
                );
                return (
                  <Link className="group relative overflow-hidden rounded-2xl border border-stone-200 bg-white p-6 shadow-[0_1px_2px_rgba(23,23,23,.04)] transition duration-300 before:absolute before:inset-x-0 before:top-0 before:h-1 before:origin-left before:scale-x-0 before:bg-[#f00073] before:transition-transform hover:-translate-y-1 hover:border-stone-300 hover:shadow-[0_20px_50px_rgba(23,23,23,.09)] hover:before:scale-x-100" href={`/projects/${project.id}`} key={project.id}>
                    <div className="flex items-start justify-between gap-4"><span className="grid size-11 place-items-center rounded-xl bg-pink-50 text-pink-600"><FolderKanban aria-hidden="true" className="size-5" /></span><ArrowRight aria-hidden="true" className="size-5 text-slate-300 transition group-hover:translate-x-1 group-hover:text-pink-500" /></div>
                    <h3 className="font-display mt-6 text-2xl leading-tight">{project.name}</h3>
                    <p className="mt-1 line-clamp-2 min-h-10 text-sm leading-5 text-slate-500">{project.description || "No description provided."}</p>
                    {showFinancials && (Number(project.retainer_hours ?? 0) > 0 || Number(project.budget_amount ?? 0) > 0) && (
                      <div className="mt-5 grid grid-cols-2 gap-3 rounded-xl bg-slate-50 p-3">
                        <div>
                          <p className="text-xs text-slate-500">Retainer available</p>
                          <p className="mt-1 text-sm font-semibold text-slate-900">
                            {remainingHours.toLocaleString("en-US", { maximumFractionDigits: 2 })}h
                          </p>
                        </div>
                        <div>
                          <p className="text-xs text-slate-500">Budget available</p>
                          <p className="mt-1 text-sm font-semibold text-slate-900">
                            {formatCurrency(remainingBudget, project.currency ?? "USD")}
                          </p>
                        </div>
                      </div>
                    )}
                    <div className="mt-4 flex gap-4 border-t border-stone-100 pt-4 text-xs text-slate-500"><span>{count.total} {isClient ? "requests" : "tickets"}</span><span>{count.completed} {isClient ? "delivered" : "completed"}</span></div>
                  </Link>
                );
              })}
            </div>
          ) : (
            <div className="rounded-2xl border border-dashed border-slate-300 bg-white px-6 py-14 text-center"><FolderKanban aria-hidden="true" className="mx-auto size-8 text-slate-300" /><h3 className="mt-4 font-semibold">No projects yet</h3><p className="mt-1 text-sm text-slate-500">{role === "admin" ? "Create the first project above." : "An admin can add you to a project."}</p></div>
          )}
        </section>
      </div>
    </main>
  );
}
