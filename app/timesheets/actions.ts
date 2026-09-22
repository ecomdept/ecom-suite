"use server";

import { revalidatePath } from "next/cache";
import { requireUser } from "@/lib/auth/session";
import { isUuid } from "@/lib/projects/validation";

export type TimesheetActionState = { error?: string; success?: string };

function validDate(value: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const parsed = new Date(`${value}T00:00:00.000Z`);
  return !Number.isNaN(parsed.getTime()) && parsed.toISOString().slice(0, 10) === value;
}

export async function updateTimesheetEntryAction(
  previousState: TimesheetActionState,
  formData: FormData,
): Promise<TimesheetActionState> {
  void previousState;
  const entryValue = formData.get("entryId");
  const hoursValue = formData.get("hours");
  const dateValue = formData.get("workDate");
  const entryId = typeof entryValue === "string" ? entryValue : "";
  const hours = typeof hoursValue === "string" ? Number(hoursValue) : Number.NaN;
  const workDate = typeof dateValue === "string" ? dateValue : "";
  if (!isUuid(entryId)) return { error: "Invalid timesheet entry." };
  if (!Number.isFinite(hours) || hours === 0 || Math.abs(hours) > 24) return { error: "Hours must be non-zero and between -24 and 24." };
  if (!validDate(workDate)) return { error: "Select a valid work date." };

  const { supabase, claims } = await requireUser();
  const userId = typeof claims.sub === "string" ? claims.sub : "";
  const [{ data: roleRecord }, { data: entry }] = await Promise.all([
    supabase.from("user_roles").select("role").eq("user_id", userId).maybeSingle(),
    supabase.from("ticket_time_entries").select("project_id, ticket_id, worker_id").eq("id", entryId).maybeSingle(),
  ]);
  if (!roleRecord?.role || roleRecord.role === "client") return { error: "Timesheets are not available for this account." };
  if (!entry) return { error: "The timesheet entry could not be found." };
  if (entry.worker_id !== userId && roleRecord.role !== "admin") return { error: "You can only update your own timesheet." };

  const { error } = await supabase.rpc("update_timesheet_entry", {
    target_entry_id: entryId,
    next_hours: hours,
    next_work_date: workDate,
  });
  if (error) return { error: error.message.includes("only update") ? "You can only update your own timesheet." : "The timesheet entry could not be updated." };

  revalidatePath("/timesheets");
  revalidatePath(`/projects/${entry.project_id}`);
  revalidatePath(`/projects/${entry.project_id}/tickets/${entry.ticket_id}`);
  revalidatePath("/dashboard");
  return { success: "Updated" };
}
