"use server";

import { revalidatePath } from "next/cache";
import { requireUser } from "@/lib/auth/session";
import { isUuid, parseOptionalNonnegativeNumber, validateLongText, validateOptionalUrl } from "@/lib/projects/validation";

export type CrmActionState = { error?: string; success?: string };

function value(formData: FormData, key: string) {
  const entry = formData.get(key);
  return typeof entry === "string" ? entry.trim() : "";
}

function optional(formData: FormData, key: string) {
  return value(formData, key) || null;
}

function validDate(date: string | null) {
  if (date === null) return true;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return false;
  const parsed = new Date(`${date}T00:00:00.000Z`);
  return !Number.isNaN(parsed.getTime()) && parsed.toISOString().slice(0, 10) === date;
}

export async function updateClientAccountAction(previousState: CrmActionState, formData: FormData): Promise<CrmActionState> {
  void previousState;
  const projectId = value(formData, "projectId");
  const services = [...new Set(formData.getAll("services").map(String).filter((service) => ["development", "email", "digital"].includes(service)))];
  const retainerStartDate = optional(formData, "retainerStartDate");
  const retainerEndDate = optional(formData, "retainerEndDate");
  const renewalDate = optional(formData, "renewalDate");
  const contractStatus = value(formData, "contractStatus");
  const projectManagerValue = value(formData, "projectManagerId");
  const developerValue = value(formData, "primaryDeveloperId");
  const projectManagerId = isUuid(projectManagerValue) ? projectManagerValue : null;
  const primaryDeveloperId = isUuid(developerValue) ? developerValue : null;
  const pocName = optional(formData, "pocName");
  const pocEmail = optional(formData, "pocEmail");
  const pocPhone = optional(formData, "pocPhone");
  const billingEmail = optional(formData, "billingEmail");
  const location = optional(formData, "location");
  const timezone = optional(formData, "timezone");
  const websiteUrl = optional(formData, "websiteUrl");
  const notes = optional(formData, "notes");
  const retainerHours = parseOptionalNonnegativeNumber(value(formData, "retainerHours"), 100000);
  const hourlyRate = parseOptionalNonnegativeNumber(value(formData, "hourlyRate"), 1000000);

  if (!isUuid(projectId)) return { error: "Invalid client account." };
  if (!services.length) return { error: "Select at least one service." };
  if (!["active", "renewal_due", "paused", "ended"].includes(contractStatus)) return { error: "Select a valid contract status." };
  if (![retainerStartDate, retainerEndDate, renewalDate].every(validDate)) return { error: "Enter valid contract dates." };
  if (retainerStartDate && retainerEndDate && retainerEndDate < retainerStartDate) return { error: "The end date cannot be before the start date." };
  if (retainerHours === undefined || hourlyRate === undefined) return { error: "Enter valid retainer hours and hourly rate." };
  const urlError = validateOptionalUrl(websiteUrl ?? "", "Website URL");
  const notesError = validateLongText(notes ?? "", "Notes", 10000);
  if (urlError || notesError) return { error: urlError ?? notesError ?? undefined };
  if (pocEmail && !/^\S+@\S+\.\S+$/.test(pocEmail)) return { error: "Enter a valid POC email." };
  if (billingEmail && !/^\S+@\S+\.\S+$/.test(billingEmail)) return { error: "Enter a valid billing email." };

  const { supabase, claims } = await requireUser();
  const userId = typeof claims.sub === "string" ? claims.sub : "";
  const { data: roleRecord } = await supabase.from("user_roles").select("role").eq("user_id", userId).maybeSingle();
  if (roleRecord?.role !== "admin" && roleRecord?.role !== "project_manager") return { error: "Only administrators and project managers can update the CRM." };

  const [{ error: accountError }, { error: projectError }] = await Promise.all([
    supabase.from("client_accounts").upsert({ project_id: projectId, services, retainer_start_date: retainerStartDate, retainer_end_date: retainerEndDate, renewal_date: renewalDate, contract_status: contractStatus, project_manager_id: projectManagerId, primary_developer_id: primaryDeveloperId, poc_name: pocName, poc_email: pocEmail, poc_phone: pocPhone, billing_email: billingEmail, location, timezone, website_url: websiteUrl, notes }, { onConflict: "project_id" }),
    supabase.from("projects").update({ retainer_hours: retainerHours, hourly_rate: hourlyRate }).eq("id", projectId).eq("project_type", "retainer"),
  ]);
  if (accountError || projectError) return { error: "The client account could not be updated. Confirm the CRM migration is applied." };
  const assignedStaffIds = [...new Set([projectManagerId, primaryDeveloperId].filter((id): id is string => Boolean(id)))];
  if (assignedStaffIds.length) {
    const { error: membershipError } = await supabase.from("project_members").upsert(
      assignedStaffIds.map((staffId) => ({ project_id: projectId, user_id: staffId, added_by: userId })),
      { onConflict: "project_id,user_id", ignoreDuplicates: true },
    );
    if (membershipError) return { error: "The CRM record was saved, but its assigned team members could not be granted project access." };
  }
  revalidatePath("/crm");
  revalidatePath(`/projects/${projectId}`);
  return { success: "Client account updated." };
}
