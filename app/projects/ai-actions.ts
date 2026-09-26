"use server";

import { revalidatePath } from "next/cache";
import { requireUser } from "@/lib/auth/session";
import { isUuid, validateLongText } from "@/lib/projects/validation";
import type { ProjectActionState } from "@/app/projects/actions";

function getString(formData: FormData, key: string) {
  const value = formData.get(key);
  return typeof value === "string" ? value : "";
}

async function getCurrentRole() {
  const { supabase, claims } = await requireUser();
  const userId = typeof claims.sub === "string" ? claims.sub : "";
  const { data: roleRecord } = await supabase
    .from("user_roles")
    .select("role")
    .eq("user_id", userId)
    .maybeSingle();

  return { supabase, userId, role: roleRecord?.role };
}

function isMissingAnalysisTable(code: string | undefined) {
  return code === "PGRST204" || code === "42703" || code === "42P01" || code === "PGRST205";
}

export async function publishClientSummaryAction(
  previousState: ProjectActionState,
  formData: FormData,
): Promise<ProjectActionState> {
  void previousState;
  const projectId = getString(formData, "projectId");
  const ticketId = getString(formData, "ticketId");
  const clientSummary = getString(formData, "clientSummary").trim();

  if (!isUuid(projectId) || !isUuid(ticketId)) return { error: "Invalid ticket." };
  const lengthError = validateLongText(clientSummary, "Summary", 4000);
  if (lengthError) return { error: lengthError };

  const { supabase, role } = await getCurrentRole();
  if (role !== "admin" && role !== "project_manager") {
    return { error: "Only administrators and project managers can publish to this ticket." };
  }

  const { error } = await supabase
    .from("tickets")
    .update({ client_summary: clientSummary || null })
    .eq("id", ticketId)
    .eq("project_id", projectId);

  if (error) {
    if (isMissingAnalysisTable(error.code)) {
      return { error: "Publishing requires the latest database migration." };
    }
    return { error: "The summary could not be published." };
  }

  revalidatePath(`/projects/${projectId}/tickets/${ticketId}`);
  return { success: clientSummary ? "Published to the ticket." : "Removed from the ticket." };
}

export async function deleteTicketAnalysisAction(
  previousState: ProjectActionState,
  formData: FormData,
): Promise<ProjectActionState> {
  void previousState;
  const projectId = getString(formData, "projectId");
  const ticketId = getString(formData, "ticketId");
  const analysisId = getString(formData, "analysisId");

  if (!isUuid(projectId) || !isUuid(ticketId) || !isUuid(analysisId)) return { error: "Invalid analysis." };

  const { supabase, role } = await getCurrentRole();
  if (role !== "admin" && role !== "project_manager") {
    return { error: "Only administrators and project managers can delete an analysis." };
  }

  const { error } = await supabase.from("ticket_ai_analyses").delete().eq("id", analysisId);

  if (error) {
    if (isMissingAnalysisTable(error.code)) {
      return { error: "AI analysis requires the latest database migration." };
    }
    return { error: "The analysis could not be deleted." };
  }

  revalidatePath(`/projects/${projectId}/tickets/${ticketId}`);
  return { success: "Analysis deleted." };
}
