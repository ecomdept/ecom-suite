import { notFound } from "next/navigation";
import { AppHeader } from "@/components/app-header";
import { ClientCrmDashboard, type ClientAccountRow, type CrmStaffOption } from "@/components/crm/client-crm-dashboard";
import { requireUser } from "@/lib/auth/session";

export const metadata = { title: "Client CRM" };
export const instant = false;

export default async function CrmPage() {
  const { supabase, claims } = await requireUser();
  const userId = typeof claims.sub === "string" ? claims.sub : "";
  const { data: currentRole } = await supabase.from("user_roles").select("role").eq("user_id", userId).maybeSingle();
  if (currentRole?.role !== "admin" && currentRole?.role !== "project_manager") notFound();

  const [{ data: projects }, { data: accounts, error: accountError }, { data: staffRoles }] = await Promise.all([
    supabase.from("projects").select("id, name, client_logo_url, retainer_hours, hourly_rate, status, risk").eq("project_type", "retainer").order("name"),
    supabase.from("client_accounts").select("project_id, services, retainer_start_date, retainer_end_date, renewal_date, contract_status, project_manager_id, primary_developer_id, poc_name, poc_email, poc_phone, billing_email, location, timezone, website_url, notes"),
    supabase.from("user_roles").select("user_id, role, additional_roles"),
  ]);
  const eligibleStaffRoles = (staffRoles ?? []).flatMap((staffRole) =>
    [staffRole.role, ...(staffRole.additional_roles ?? [])]
      .filter(
        (role): role is "project_manager" | "developer" =>
          role === "project_manager" || role === "developer",
      )
      .map((role) => ({ userId: staffRole.user_id, role })),
  );
  const staffIds = [...new Set(eligibleStaffRoles.map((staff) => staff.userId))];
  const { data: profiles } = staffIds.length ? await supabase.from("profiles").select("id, full_name").in("id", staffIds) : { data: [] };
  const nameById = new Map((profiles ?? []).map((profile) => [profile.id, profile.full_name || "Unnamed user"]));
  const staff: CrmStaffOption[] = eligibleStaffRoles.map((staffRole) => ({ id: staffRole.userId, name: nameById.get(staffRole.userId) ?? `User ${staffRole.userId.slice(0, 8)}`, role: staffRole.role }));
  const accountByProject = new Map((accounts ?? []).map((account) => [account.project_id, account]));
  const rows: ClientAccountRow[] = (projects ?? []).map((project) => {
    const account = accountByProject.get(project.id);
    return {
      projectId: project.id,
      clientName: project.name,
      clientLogoUrl: project.client_logo_url,
      retainerHours: Number(project.retainer_hours ?? 0),
      hourlyRate: Number(project.hourly_rate ?? 0),
      projectStatus: project.status,
      projectRisk: project.risk,
      services: account?.services ?? ["development"],
      retainerStartDate: account?.retainer_start_date ?? null,
      retainerEndDate: account?.retainer_end_date ?? null,
      renewalDate: account?.renewal_date ?? null,
      contractStatus: account?.contract_status ?? "active",
      projectManagerId: account?.project_manager_id ?? null,
      primaryDeveloperId: account?.primary_developer_id ?? null,
      pocName: account?.poc_name ?? null,
      pocEmail: account?.poc_email ?? null,
      pocPhone: account?.poc_phone ?? null,
      billingEmail: account?.billing_email ?? null,
      location: account?.location ?? null,
      timezone: account?.timezone ?? null,
      websiteUrl: account?.website_url ?? null,
      notes: account?.notes ?? null,
    };
  });

  return <main className="min-h-svh bg-[#f6f3ee] text-slate-950"><AppHeader/><ClientCrmDashboard migrationMissing={Boolean(accountError)} rows={rows} staff={staff}/></main>;
}
