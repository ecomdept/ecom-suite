"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireUser } from "@/lib/auth/session";
import {
  isTicketPriority,
  isTicketStatus,
  isTicketType,
  isTicketPlatform,
  isUuid,
  parseOptionalNonnegativeNumber,
  validateDescription,
  validateComment,
  validateProjectName,
  validateTicketTitle,
  validateLongText,
  validateOptionalUrl,
} from "@/lib/projects/validation";

export type ProjectActionState = {
  error?: string;
  success?: string;
};

function getString(formData: FormData, key: string) {
  const value = formData.get(key);
  return typeof value === "string" ? value : "";
}

function getOptionalString(formData: FormData, key: string) {
  return getString(formData, key).trim() || null;
}

function getBoolean(formData: FormData, key: string) {
  return formData.get(key) === "on" || formData.get(key) === "true";
}

function isIsoDate(value: string | null) {
  if (value === null) return true;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const parsed = new Date(`${value}T00:00:00.000Z`);
  return !Number.isNaN(parsed.getTime()) && parsed.toISOString().slice(0, 10) === value;
}

function isProjectType(value: string): value is "retainer" | "new_build" {
  return value === "retainer" || value === "new_build";
}

function isProjectStatus(value: string): value is "active" | "on_hold" | "completed" {
  return value === "active" || value === "on_hold" || value === "completed";
}

function isProjectRisk(value: string): value is "on_track" | "at_risk" | "off_track" {
  return value === "on_track" || value === "at_risk" || value === "off_track";
}

const projectLogoTypes = new Map([
  ["image/jpeg", "jpg"],
  ["image/png", "png"],
  ["image/webp", "webp"],
]);

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

export async function createProjectAction(
  previousState: ProjectActionState,
  formData: FormData,
): Promise<ProjectActionState> {
  void previousState;
  const name = getString(formData, "name").trim();
  const description = getString(formData, "description").trim();
  const projectType = getString(formData, "projectType");
  const memberIds = [...new Set(formData.getAll("members").map(String).filter(isUuid))];
  const retainerHours = parseOptionalNonnegativeNumber(getString(formData, "retainerHours"), 100000);
  const hourlyRate = parseOptionalNonnegativeNumber(getString(formData, "hourlyRate"), 1000000);
  const sprintStartDate = getOptionalString(formData, "sprintStartDate");
  const repositoryUrl = getOptionalString(formData, "repositoryUrl");
  const logoValue = formData.get("clientLogo");
  const clientLogo = logoValue && typeof logoValue !== "string" && logoValue.size > 0 ? logoValue : null;
  const validationError = validateProjectName(name) ?? validateDescription(description);

  if (validationError) return { error: validationError };
  if (!isProjectType(projectType)) return { error: "Select a valid project type." };
  if (retainerHours === undefined) return { error: "Enter valid sprint hours." };
  if (hourlyRate === undefined) return { error: "Enter a valid hourly rate." };
  if (!sprintStartDate || !isIsoDate(sprintStartDate)) return { error: "Select a valid sprint starting date." };
  const repositoryError = validateOptionalUrl(repositoryUrl ?? "", "GitHub repository URL");
  if (repositoryError) return { error: repositoryError };
  if (clientLogo && (!projectLogoTypes.has(clientLogo.type) || clientLogo.size > 1024 * 1024)) {
    return { error: "Upload a PNG, JPG, or WebP logo no larger than 1 MB." };
  }

  const { supabase, userId, role } = await getCurrentRole();
  if (role !== "admin") return { error: "Only administrators can create projects." };

  const { data: project, error: projectError } = await supabase
    .from("projects")
    .insert({
      name,
      description: description || null,
      created_by: userId,
      project_type: projectType,
      retainer_hours: projectType === "retainer" ? retainerHours : null,
      hourly_rate: hourlyRate,
      sprint_start_date: sprintStartDate,
      repository_url: repositoryUrl,
      currency: "USD",
    })
    .select("id")
    .single();

  if (projectError || !project) {
    return { error: "The project could not be created. Confirm the latest database migration is applied." };
  }

  const allMemberIds = [...new Set([userId, ...memberIds])];
  const { error: membershipError } = await supabase.from("project_members").insert(
    allMemberIds.map((memberId) => ({
      project_id: project.id,
      user_id: memberId,
      added_by: userId,
    })),
  );

  if (membershipError) {
    await supabase.from("projects").delete().eq("id", project.id);
    return {
      error: "The project could not be created because its members could not be assigned.",
    };
  }

  if (clientLogo) {
    const extension = projectLogoTypes.get(clientLogo.type);
    const logoPath = `${project.id}/${crypto.randomUUID()}.${extension}`;
    const { error: uploadError } = await supabase.storage
      .from("project-logos")
      .upload(logoPath, clientLogo, { contentType: clientLogo.type, upsert: false });

    if (uploadError) {
      await supabase.from("projects").delete().eq("id", project.id);
      return { error: "The logo could not be uploaded, so the project was not created." };
    }

    const { data: publicLogo } = supabase.storage.from("project-logos").getPublicUrl(logoPath);
    const { error: logoUpdateError } = await supabase
      .from("projects")
      .update({ client_logo_url: publicLogo.publicUrl })
      .eq("id", project.id);
    if (logoUpdateError) {
      await supabase.storage.from("project-logos").remove([logoPath]);
      await supabase.from("projects").delete().eq("id", project.id);
      return { error: "The logo could not be linked, so the project was not created." };
    }
  }

  revalidatePath("/projects");
  redirect(`/projects/${project.id}`);
}

export async function createTicketAction(
  previousState: ProjectActionState,
  formData: FormData,
): Promise<ProjectActionState> {
  void previousState;
  const projectId = getString(formData, "projectId");
  const title = getString(formData, "title").trim();
  const description = getString(formData, "description").trim();
  const priority = getString(formData, "priority");
  const ticketType = getString(formData, "ticketType");
  const estimatedHours = parseOptionalNonnegativeNumber(getString(formData, "estimatedHours"), 100000);
  const acceptanceCriteria = getOptionalString(formData, "acceptanceCriteria");
  const reproductionSteps = getOptionalString(formData, "reproductionSteps");
  const expectedBehavior = getOptionalString(formData, "expectedBehavior");
  const actualBehavior = getOptionalString(formData, "actualBehavior");
  const affectedPlatforms = [...new Set(formData.getAll("affectedPlatforms").map(String).filter(isTicketPlatform))];
  const referenceUrl = getOptionalString(formData, "referenceUrl");
  const previewUrl = getOptionalString(formData, "previewUrl");
  const repositoryUrl = getOptionalString(formData, "repositoryUrl");
  const designUrl = getOptionalString(formData, "designUrl");
  const devNotes = getOptionalString(formData, "devNotes");
  const assigneeIdValue = getString(formData, "assigneeId");
  const assigneeId = isUuid(assigneeIdValue) ? assigneeIdValue : null;
  const dueDate = getOptionalString(formData, "dueDate");
  const validationError = validateTicketTitle(title) ?? validateDescription(description);

  if (!isUuid(projectId)) return { error: "Invalid project." };
  if (validationError) return { error: validationError };
  if (!isTicketPriority(priority)) return { error: "Select a valid priority." };
  if (!isTicketType(ticketType)) return { error: "Select a valid work type." };
  if (estimatedHours === undefined) return { error: "Enter valid estimated hours." };
  if (!isIsoDate(dueDate)) return { error: "Enter a valid due date." };
  const detailError =
    validateLongText(acceptanceCriteria ?? "", "Acceptance criteria") ??
    validateLongText(reproductionSteps ?? "", "Reproduction steps") ??
    validateLongText(expectedBehavior ?? "", "Expected behavior", 3000) ??
    validateLongText(actualBehavior ?? "", "Actual behavior", 3000) ??
    validateLongText(devNotes ?? "", "Development notes", 10000) ??
    validateOptionalUrl(referenceUrl ?? "", "Reference URL") ??
    validateOptionalUrl(previewUrl ?? "", "Preview URL") ??
    validateOptionalUrl(repositoryUrl ?? "", "GitHub repository URL") ??
    validateOptionalUrl(designUrl ?? "", "Design URL");
  if (detailError) return { error: detailError };
  const { supabase, userId, role } = await getCurrentRole();
  const isManager = role === "admin" || role === "project_manager";
  const isAgencyMember = Boolean(role && role !== "client");

  if (isManager && assigneeId) {
    const { data: membership } = await supabase
      .from("project_members")
      .select("user_id")
      .eq("project_id", projectId)
      .eq("user_id", assigneeId)
      .maybeSingle();
    if (!membership) return { error: "The assignee must be a member of this project." };
  }

  const { error } = await supabase.from("tickets").insert({
    project_id: projectId,
    title,
    description: description || null,
    priority,
    ticket_type: ticketType,
    acceptance_criteria: acceptanceCriteria,
    reproduction_steps: ticketType === "bug" ? reproductionSteps : null,
    expected_behavior: ticketType === "bug" ? expectedBehavior : null,
    actual_behavior: ticketType === "bug" ? actualBehavior : null,
    affected_platforms: ticketType === "bug" ? affectedPlatforms : [],
    reference_url: referenceUrl,
    preview_url: isAgencyMember ? previewUrl : null,
    repository_url: isAgencyMember ? repositoryUrl : null,
    design_url: designUrl,
    dev_notes: isAgencyMember ? devNotes : null,
    assignee_id: isManager ? assigneeId : null,
    due_date: isManager ? dueDate : null,
    estimated_hours: isManager ? estimatedHours ?? 0 : 0,
    created_by: userId,
  });

  if (error) {
    if (error.code === "PGRST204" || error.code === "42703" || error.message.toLowerCase().includes("reference_url")) {
      return { error: "Ticket references require the latest database migration." };
    }
    return { error: "The ticket could not be created for this project." };
  }

  revalidatePath(`/projects/${projectId}`);
  revalidatePath("/dashboard");
  revalidatePath("/my-tasks");
  return { success: "Ticket added to the backlog." };
}

export async function submitTicketForApprovalAction(
  previousState: ProjectActionState,
  formData: FormData,
): Promise<ProjectActionState> {
  void previousState;
  const projectId = getString(formData, "projectId");
  const ticketId = getString(formData, "ticketId");
  const workCategory = getString(formData, "workCategory");
  const estimatedHours = parseOptionalNonnegativeNumber(getString(formData, "estimatedHours"), 100000);
  if (!isUuid(projectId) || !isUuid(ticketId)) return { error: "Invalid ticket." };
  if (workCategory !== "admin_work" && workCategory !== "dev_work") return { error: "Choose admin or development work." };
  if (estimatedHours === undefined || estimatedHours === null || estimatedHours <= 0) return { error: "Add an estimate greater than zero." };

  const { supabase, role } = await getCurrentRole();
  if (role !== "admin" && role !== "project_manager") return { error: "Only administrators and project managers can request approval." };
  const { error } = await supabase.rpc("prepare_ticket_for_approval", {
    target_ticket_id: ticketId,
    target_project_id: projectId,
    next_work_category: workCategory,
    next_estimated_hours: estimatedHours,
  });
  if (error) {
    console.error("prepare_ticket_for_approval failed", { code: error.code, message: error.message });
    if (error.code === "PGRST202" || error.code === "42883") return { error: "Apply the latest ticket workflow migration, then try again." };
    if (error.code === "42703" && error.message.includes("subtask_type")) return { error: "The ticket subtask workflow columns are missing. Apply migration 20261005030000, then try again." };
    if (error.code === "42704") return { error: "The core ticket workflow schema is missing. Reapply migration 20261005010000, then try again." };
    if (error.code === "22P02" && error.message.includes("ticket_status")) return { error: "The approval and UAT ticket statuses are missing. Apply migration 20261005000000 in a separate SQL run, then try again." };
    if (error.code === "42501" || error.message.toLowerCase().includes("project managers")) return { error: "You no longer have permission to manage this ticket." };
    return { error: "The approval workflow could not be prepared. Check the server log for the database error." };
  }
  revalidatePath(`/projects/${projectId}`);
  revalidatePath(`/projects/${projectId}/tickets/${ticketId}`);
  revalidatePath("/dashboard");
  return { success: "Estimate sent to the client for approval." };
}

export async function requestEstimateIncreaseAction(
  previousState: ProjectActionState,
  formData: FormData,
): Promise<ProjectActionState> {
  void previousState;
  const projectId = getString(formData, "projectId");
  const ticketId = getString(formData, "ticketId");
  const estimatedHours = parseOptionalNonnegativeNumber(
    getString(formData, "estimatedHours"),
    100000,
  );

  if (!isUuid(projectId) || !isUuid(ticketId)) {
    return { error: "Invalid ticket." };
  }
  if (
    estimatedHours === undefined ||
    estimatedHours === null ||
    estimatedHours <= 0
  ) {
    return { error: "Enter a valid revised estimate." };
  }

  const { supabase, role } = await getCurrentRole();
  if (role !== "admin" && role !== "project_manager") {
    return { error: "Only administrators and project managers can request an estimate increase." };
  }

  const { error } = await supabase.rpc("request_ticket_estimate_increase", {
    target_ticket_id: ticketId,
    target_project_id: projectId,
    next_estimated_hours: estimatedHours,
  });

  if (error) {
    console.error("request_ticket_estimate_increase failed", {
      code: error.code,
      message: error.message,
    });
    if (error.code === "PGRST202" || error.code === "42883") {
      return {
        error:
          "Apply migration 20261005150000, then request the estimate increase again.",
      };
    }
    if (error.message.toLowerCase().includes("greater than")) {
      return { error: "The revised estimate must be greater than the current estimate." };
    }
    if (error.message.toLowerCase().includes("active delivery")) {
      return { error: "Estimate increases can only be requested while the ticket is in active delivery." };
    }
    return { error: "The estimate increase could not be sent for approval." };
  }

  revalidatePath(`/projects/${projectId}`);
  revalidatePath(`/projects/${projectId}/tickets/${ticketId}`);
  revalidatePath("/dashboard");
  return { success: "The revised estimate was sent to the client for approval." };
}

export async function respondToEstimateAction(previousState: ProjectActionState, formData: FormData): Promise<ProjectActionState> {
  void previousState;
  const projectId = getString(formData, "projectId");
  const ticketId = getString(formData, "ticketId");
  const approve = getString(formData, "decision") === "approve";
  const isIncrease = getString(formData, "estimateKind") === "increase";
  if (!isUuid(projectId) || !isUuid(ticketId)) return { error: "Invalid ticket." };
  const { supabase, role } = await getCurrentRole();
  if (role !== "client") return { error: "Only a client assigned to this project can respond to the estimate." };
  const { error } = await supabase.rpc("respond_to_ticket_estimate", { target_ticket_id: ticketId, approve });
  if (error) {
    console.error("respond_to_ticket_estimate failed", { code: error.code, message: error.message });
    if (error.code === "PGRST202" || error.code === "42883") return { error: "Apply the latest estimate-decision migration, then try again." };
    return { error: "The estimate decision could not be saved. Check the server log for the database error." };
  }
  revalidatePath(`/projects/${projectId}/tickets/${ticketId}`);
  revalidatePath("/dashboard");
  revalidatePath("/my-tasks");
  return {
    success: approve
      ? isIncrease
        ? "The revised estimate was approved."
        : "Estimate approved. The ticket is now in delivery."
      : isIncrease
        ? "The increase was declined. The original estimate remains in place."
        : "Changes requested. The ticket was returned to the PM.",
  };
}

export async function respondToUatAction(previousState: ProjectActionState, formData: FormData): Promise<ProjectActionState> {
  void previousState;
  const projectId = getString(formData, "projectId");
  const ticketId = getString(formData, "ticketId");
  const approve = getString(formData, "decision") === "approve";
  const feedback = getString(formData, "feedback").trim();
  if (!isUuid(projectId) || !isUuid(ticketId)) return { error: "Invalid ticket." };
  if (!approve && !feedback) return { error: "Describe what needs to change before sending the ticket back." };
  const feedbackError = validateLongText(feedback, "Client feedback", 2000);
  if (feedbackError) return { error: feedbackError };
  const { supabase, role } = await getCurrentRole();
  if (role !== "client") return { error: "Only the requesting client can complete UAT." };
  const { error } = await supabase.rpc("respond_to_ticket_uat", { target_ticket_id: ticketId, approve, client_feedback: feedback || null });
  if (error) {
    if (error.code === "PGRST202" || error.code === "42883") return { error: "Apply the latest UAT workflow migration, then try again." };
    return { error: approve ? "The ticket could not be accepted." : "Your feedback could not be submitted." };
  }
  revalidatePath(`/projects/${projectId}/tickets/${ticketId}`);
  revalidatePath("/dashboard");
  revalidatePath("/my-tasks");
  return { success: approve ? "UAT accepted. The ticket is ready for deployment." : "Feedback submitted and the ticket returned to delivery." };
}

export async function moveTicketAction(formData: FormData): Promise<ProjectActionState> {
  const projectId = getString(formData, "projectId");
  const ticketId = getString(formData, "ticketId");
  const status = getString(formData, "status");

  if (!isUuid(projectId) || !isUuid(ticketId) || !isTicketStatus(status)) {
    return { error: "Invalid ticket movement." };
  }

  const { supabase, role } = await getCurrentRole();
  if (!role || role === "client") {
    return { error: "You do not have permission to move this ticket." };
  }

  const { error } = await supabase.rpc("move_ticket_status", {
    target_ticket_id: ticketId,
    next_status: status,
  });

  if (error) {
    if (error.code === "PGRST202" || error.message.toLowerCase().includes("move_ticket_status")) {
      return { error: "Ticket movement requires the latest database migration." };
    }
    return { error: "The ticket could not be moved." };
  }

  revalidatePath(`/projects/${projectId}`);
  revalidatePath("/my-tasks");
  return {};
}

export async function createCommentAction(
  previousState: ProjectActionState,
  formData: FormData,
): Promise<ProjectActionState> {
  void previousState;
  const projectId = getString(formData, "projectId");
  const ticketId = getString(formData, "ticketId");
  const content = getString(formData, "content").trim();
  const mentionedUserIds = [...new Set(formData.getAll("mentionedUserIds").map(String).filter(isUuid))].slice(0, 20);
  const requestedInternal = getString(formData, "commentVisibility") === "internal";
  const validationError = validateComment(content);

  if (!isUuid(projectId) || !isUuid(ticketId)) return { error: "Invalid ticket." };
  if (validationError) return { error: validationError };

  const { supabase, userId, role } = await getCurrentRole();
  const canCreateInternalNote = role === "admin" || role === "project_manager" || role === "developer" || role === "designer";
  const isInternal = requestedInternal && canCreateInternalNote;
  const { error } = await supabase.from("ticket_comments").insert({
    ticket_id: ticketId,
    user_id: userId,
    content,
    mentioned_user_ids: isInternal ? [] : mentionedUserIds,
    is_internal: isInternal,
  });

  if (error) {
    if (
      error.code === "PGRST204"
      || error.code === "42703"
      || error.message.toLowerCase().includes("is_internal")
    ) {
      return { error: "Comments require the latest database migration. Apply 20260929000000_add_internal_ticket_comments.sql in Supabase, then try again." };
    }
    if (error.code === "42501") {
      return { error: "You no longer have permission to comment on this project." };
    }
    return { error: "The comment could not be posted. Confirm you still have access to this project." };
  }

  revalidatePath(`/projects/${projectId}/tickets/${ticketId}`);
  return { success: isInternal ? "Internal note posted." : "Comment posted." };
}

export async function deleteProjectAction(
  previousState: ProjectActionState,
  formData: FormData,
): Promise<ProjectActionState> {
  void previousState;
  const projectId = getString(formData, "projectId");
  if (!isUuid(projectId)) return { error: "Invalid project." };

  const { supabase, role } = await getCurrentRole();
  if (role !== "admin") return { error: "Only administrators can delete projects." };

  const { data: project } = await supabase.from("projects").select("client_logo_url").eq("id", projectId).maybeSingle();
  const { error } = await supabase.from("projects").delete().eq("id", projectId);
  if (error) return { error: "The project could not be deleted." };

  const logoMarker = "/project-logos/";
  const logoUrl = project?.client_logo_url;
  if (logoUrl?.includes(logoMarker)) {
    const logoPath = decodeURIComponent(logoUrl.split(logoMarker)[1]?.split("?")[0] ?? "");
    if (logoPath) await supabase.storage.from("project-logos").remove([logoPath]);
  }

  revalidatePath("/projects");
  revalidatePath("/my-tasks");
  redirect("/projects");
}

export async function updateProjectMembersAction(
  previousState: ProjectActionState,
  formData: FormData,
): Promise<ProjectActionState> {
  void previousState;
  const projectId = getString(formData, "projectId");
  const requestedMemberIds = [...new Set(formData.getAll("members").map(String).filter(isUuid))];
  if (!isUuid(projectId)) return { error: "Invalid project." };

  const { supabase, userId, role } = await getCurrentRole();
  if (role !== "admin" && role !== "project_manager") return { error: "Only administrators and project managers can manage project access." };
  const desiredMemberIds = requestedMemberIds;

  const { data: existing, error: readError } = await supabase
    .from("project_members")
    .select("user_id")
    .eq("project_id", projectId);
  if (readError) return { error: "Project membership could not be loaded." };

  const existingIds = new Set((existing ?? []).map((member) => member.user_id));
  const desiredIds = new Set(desiredMemberIds);
  const toAdd = desiredMemberIds.filter((memberId) => !existingIds.has(memberId));
  const toRemove = [...existingIds].filter((memberId) => !desiredIds.has(memberId));

  if (toAdd.length) {
    const { error } = await supabase.from("project_members").insert(
      toAdd.map((memberId) => ({ project_id: projectId, user_id: memberId, added_by: userId })),
    );
    if (error) return { error: "Some users could not be added to the project." };
  }

  if (toRemove.length) {
    const { error } = await supabase
      .from("project_members")
      .delete()
      .eq("project_id", projectId)
      .in("user_id", toRemove);
    if (error) return { error: "Some users could not be removed from the project." };
  }

  revalidatePath(`/projects/${projectId}`);
  revalidatePath("/projects");
  return { success: "Project access updated." };
}

export async function updateProjectSettingsAction(
  previousState: ProjectActionState,
  formData: FormData,
): Promise<ProjectActionState> {
  void previousState;
  const projectId = getString(formData, "projectId");
  const projectType = getString(formData, "projectType");
  const retainerHours = parseOptionalNonnegativeNumber(getString(formData, "retainerHours"), 100000);
  const hourlyRate = parseOptionalNonnegativeNumber(getString(formData, "hourlyRate"), 1000000);
  const sprintStartDate = getOptionalString(formData, "sprintStartDate");
  const repositoryUrl = getOptionalString(formData, "repositoryUrl");
  const status = getString(formData, "status");
  const risk = getString(formData, "risk");
  const rolloverEnabled = getBoolean(formData, "rolloverEnabled");
  const rolloverCapHours = parseOptionalNonnegativeNumber(getString(formData, "rolloverCapHours"), 100000);

  if (!isUuid(projectId)) return { error: "Invalid project." };
  if (!isProjectType(projectType)) return { error: "Select a valid project type." };
  if (retainerHours === undefined) return { error: "Enter valid retainer hours." };
  if (hourlyRate === undefined) return { error: "Enter a valid hourly rate." };
  if (rolloverCapHours === undefined) return { error: "Enter a valid rollover cap." };
  if (!sprintStartDate || !isIsoDate(sprintStartDate)) return { error: "Select a valid sprint starting date." };
  if (!isProjectStatus(status)) return { error: "Select a valid project status." };
  if (!isProjectRisk(risk)) return { error: "Select a valid risk level." };
  const repositoryError = validateOptionalUrl(repositoryUrl ?? "", "GitHub repository URL");
  if (repositoryError) return { error: repositoryError };

  const { supabase, role } = await getCurrentRole();
  if (role !== "admin" && role !== "project_manager") return { error: "Only administrators and project managers can update project settings." };

  const { error } = await supabase
    .from("projects")
    .update({
      project_type: projectType,
      retainer_hours: projectType === "retainer" ? retainerHours : null,
      hourly_rate: hourlyRate,
      sprint_start_date: sprintStartDate,
      repository_url: repositoryUrl,
      status,
      risk,
      currency: "USD",
      rollover_enabled: projectType === "retainer" && rolloverEnabled,
      rollover_cap_hours: projectType === "retainer" && rolloverEnabled ? rolloverCapHours : null,
    })
    .eq("id", projectId);
  if (error) return { error: "Project settings could not be updated. Confirm you manage this project." };

  revalidatePath(`/projects/${projectId}`);
  revalidatePath("/projects");
  return { success: "Project delivery settings updated." };
}

export async function updateTicketUsageAction(
  previousState: ProjectActionState,
  formData: FormData,
): Promise<ProjectActionState> {
  void previousState;
  const projectId = getString(formData, "projectId");
  const ticketId = getString(formData, "ticketId");
  const loggedHours = parseOptionalNonnegativeNumber(getString(formData, "loggedHours"), 100000);

  if (!isUuid(projectId) || !isUuid(ticketId)) return { error: "Invalid ticket." };
  if (loggedHours === undefined) {
    return { error: "Logged hours must be a valid nonnegative number." };
  }

  const { supabase, role } = await getCurrentRole();
  if (role !== "admin" && role !== "project_manager") {
    return { error: "You do not have permission to update ticket usage." };
  }

  const { data: project } = await supabase.from("projects").select("hourly_rate").eq("id", projectId).maybeSingle();
  const hourlyRate = Number(project?.hourly_rate ?? 0);

  const { error } = await supabase
    .from("tickets")
    .update({
      logged_hours: loggedHours ?? 0,
      billable_amount: (loggedHours ?? 0) * hourlyRate,
    })
    .eq("id", ticketId)
    .eq("project_id", projectId);
  if (error) return { error: "Ticket usage could not be updated." };

  revalidatePath(`/projects/${projectId}`);
  revalidatePath(`/projects/${projectId}/tickets/${ticketId}`);
  revalidatePath("/dashboard");
  revalidatePath("/my-tasks");
  return { success: "Ticket usage updated." };
}

export async function updateTicketDetailsAction(
  previousState: ProjectActionState,
  formData: FormData,
): Promise<ProjectActionState> {
  void previousState;
  const projectId = getString(formData, "projectId");
  const ticketId = getString(formData, "ticketId");
  const title = getString(formData, "title").trim();
  const description = getString(formData, "description").trim();
  const ticketType = getString(formData, "ticketType");
  const priority = getString(formData, "priority");
  const acceptanceCriteria = getOptionalString(formData, "acceptanceCriteria");
  const reproductionSteps = getOptionalString(formData, "reproductionSteps");
  const expectedBehavior = getOptionalString(formData, "expectedBehavior");
  const actualBehavior = getOptionalString(formData, "actualBehavior");
  const affectedPlatforms = [...new Set(formData.getAll("affectedPlatforms").map(String).filter(isTicketPlatform))];
  const referenceUrl = getOptionalString(formData, "referenceUrl");
  const previewUrl = getOptionalString(formData, "previewUrl");
  const repositoryUrl = getOptionalString(formData, "repositoryUrl");
  const designUrl = getOptionalString(formData, "designUrl");
  const devNotes = getOptionalString(formData, "devNotes");
  const assigneeValue = getString(formData, "assigneeId");
  const assigneeId = isUuid(assigneeValue) ? assigneeValue : null;
  const dueDate = getOptionalString(formData, "dueDate");

  if (!isUuid(projectId) || !isUuid(ticketId)) return { error: "Invalid ticket." };
  const coreValidationError = validateTicketTitle(title) ?? validateDescription(description);
  if (coreValidationError) return { error: coreValidationError };
  if (!isTicketType(ticketType) || !isTicketPriority(priority)) return { error: "Select valid ticket details." };
  if (!isIsoDate(dueDate)) return { error: "Enter a valid due date." };
  const validationError =
    validateLongText(acceptanceCriteria ?? "", "Acceptance criteria") ??
    validateLongText(reproductionSteps ?? "", "Reproduction steps") ??
    validateLongText(expectedBehavior ?? "", "Expected behavior", 3000) ??
    validateLongText(actualBehavior ?? "", "Actual behavior", 3000) ??
    validateLongText(devNotes ?? "", "Development notes", 10000) ??
    validateOptionalUrl(referenceUrl ?? "", "Reference URL") ??
    validateOptionalUrl(previewUrl ?? "", "Preview URL") ??
    validateOptionalUrl(repositoryUrl ?? "", "GitHub repository URL") ??
    validateOptionalUrl(designUrl ?? "", "Design URL");
  if (validationError) return { error: validationError };
  const { supabase, role } = await getCurrentRole();
  if (role !== "admin" && role !== "project_manager") {
    return { error: "Only administrators and project managers can edit ticket details." };
  }

  if (assigneeId) {
    const { data: membership } = await supabase
      .from("project_members")
      .select("user_id")
      .eq("project_id", projectId)
      .eq("user_id", assigneeId)
      .maybeSingle();
    if (!membership) return { error: "The assignee must be a member of this project." };
  }

  const { error } = await supabase
    .from("tickets")
    .update({
      title,
      description: description || null,
      ticket_type: ticketType,
      priority,
      acceptance_criteria: acceptanceCriteria,
      reproduction_steps: ticketType === "bug" ? reproductionSteps : null,
      expected_behavior: ticketType === "bug" ? expectedBehavior : null,
      actual_behavior: ticketType === "bug" ? actualBehavior : null,
      affected_platforms: ticketType === "bug" ? affectedPlatforms : [],
      reference_url: referenceUrl,
      preview_url: previewUrl,
      repository_url: repositoryUrl,
      design_url: designUrl,
      dev_notes: devNotes,
      assignee_id: assigneeId,
      due_date: dueDate,
    })
    .eq("id", ticketId)
    .eq("project_id", projectId);
  if (error) {
    if (error.code === "PGRST204" || error.code === "42703" || error.message.toLowerCase().includes("reference_url")) {
      return { error: "Ticket references require the latest database migration." };
    }
    return { error: "Ticket details could not be updated." };
  }

  revalidatePath(`/projects/${projectId}`);
  revalidatePath(`/projects/${projectId}/tickets/${ticketId}`);
  revalidatePath("/dashboard");
  revalidatePath("/my-tasks");
  return { success: "Ticket details updated." };
}

export async function createSubtaskAction(
  previousState: ProjectActionState,
  formData: FormData,
): Promise<ProjectActionState> {
  void previousState;
  const projectId = getString(formData, "projectId");
  const ticketId = getString(formData, "ticketId");
  const title = getString(formData, "title").trim();
  const description = getOptionalString(formData, "description");
  const dueDate = getOptionalString(formData, "dueDate");
  const assigneeValue = getString(formData, "assigneeId");
  const assigneeId = isUuid(assigneeValue) ? assigneeValue : null;
  const estimatedHours = parseOptionalNonnegativeNumber(getString(formData, "estimatedHours"), 100000);
  const loggedHours = parseOptionalNonnegativeNumber(getString(formData, "loggedHours"), 100000);

  if (!isUuid(projectId) || !isUuid(ticketId)) return { error: "Invalid ticket." };
  if (title.length < 2 || title.length > 200) return { error: "Subtask title must be between 2 and 200 characters." };
  if ((description?.length ?? 0) > 2000) return { error: "Subtask description must be 2,000 characters or less." };
  if (!isIsoDate(dueDate)) return { error: "Enter a valid due date." };
  if (estimatedHours === undefined || loggedHours === undefined) return { error: "Enter valid estimated and logged hours." };

  const { supabase, userId, role } = await getCurrentRole();
  if (!role || role === "client") return { error: "You do not have permission to create subtasks." };

  const { error } = await supabase.from("ticket_subtasks").insert({
    ticket_id: ticketId,
    title,
    description,
    due_date: dueDate,
    assignee_id: assigneeId,
    estimated_hours: estimatedHours ?? 0,
    logged_hours: loggedHours ?? 0,
    created_by: userId,
  });
  if (error) return { error: "The subtask could not be created. Confirm its assignee belongs to this project." };

  revalidatePath(`/projects/${projectId}/tickets/${ticketId}`);
  revalidatePath("/my-tasks");
  return { success: "Subtask added." };
}

export async function setSubtaskCompletionAction(formData: FormData): Promise<void> {
  const projectId = getString(formData, "projectId");
  const ticketId = getString(formData, "ticketId");
  const subtaskId = getString(formData, "subtaskId");
  const isCompleted = getString(formData, "isCompleted") === "true";
  if (!isUuid(projectId) || !isUuid(ticketId) || !isUuid(subtaskId)) return;

  const { supabase, role } = await getCurrentRole();
  if (!role || role === "client") return;
  const { data: currentSubtask } = await supabase.from("ticket_subtasks").select("subtask_type, title, is_internal").eq("id", subtaskId).eq("ticket_id", ticketId).maybeSingle();
  // Development completion must go through completeDevSubtaskAction so its
  // required handoff links are validated on the server.
  if (isCompleted && currentSubtask?.subtask_type === "dev") return;
  const { data: updatedSubtask, error } = await supabase
    .from("ticket_subtasks")
    .update({ is_completed: isCompleted })
    .eq("id", subtaskId)
    .eq("ticket_id", ticketId)
    .select("subtask_type, title, is_internal")
    .maybeSingle();
  if (error) return;

  if (isCompleted && updatedSubtask?.subtask_type === "qa") {
    const { data: ticket } = await supabase.from("tickets").select("created_by").eq("id", ticketId).maybeSingle();
    await supabase.from("tickets").update({ status: "client_uat", approval_status: "uat_pending", uat_requested_at: new Date().toISOString(), assignee_id: ticket?.created_by ?? null }).eq("id", ticketId);
  }
  if (isCompleted && !updatedSubtask?.is_internal && updatedSubtask?.title === "Client feedback") {
    const { data: ticket } = await supabase.from("tickets").select("created_by").eq("id", ticketId).maybeSingle();
    await supabase.from("tickets").update({ status: "client_uat", approval_status: "uat_pending", uat_requested_at: new Date().toISOString(), uat_approved_at: null, assignee_id: ticket?.created_by ?? null }).eq("id", ticketId);
  }
  if (isCompleted && updatedSubtask?.subtask_type === "dev") {
    const { data: qaStep } = await supabase.from("ticket_subtasks").select("assignee_id").eq("ticket_id", ticketId).eq("subtask_type", "qa").maybeSingle();
    await supabase.from("tickets").update({ status: "in_progress", assignee_id: qaStep?.assignee_id ?? null }).eq("id", ticketId);
  }
  if (isCompleted && updatedSubtask?.subtask_type === "deploy") {
    const { data: ticket } = await supabase.from("tickets").select("approval_status").eq("id", ticketId).maybeSingle();
    if (ticket?.approval_status === "uat_approved") await supabase.from("tickets").update({ status: "completed", assignee_id: null }).eq("id", ticketId);
  }

  revalidatePath(`/projects/${projectId}/tickets/${ticketId}`);
  revalidatePath(`/projects/${projectId}`);
  revalidatePath("/dashboard");
  revalidatePath("/my-tasks");
}

export async function completeDevSubtaskAction(
  previousState: ProjectActionState,
  formData: FormData,
): Promise<ProjectActionState> {
  void previousState;
  const projectId = getString(formData, "projectId");
  const ticketId = getString(formData, "ticketId");
  const subtaskId = getString(formData, "subtaskId");
  const pullRequestUrl = getString(formData, "pullRequestUrl").trim();
  const previewUrl = getString(formData, "previewUrl").trim();
  const devNotes = getOptionalString(formData, "devNotes");
  if (!isUuid(projectId) || !isUuid(ticketId) || !isUuid(subtaskId)) return { error: "Invalid development task." };
  if (!pullRequestUrl) return { error: "A pull request link is required." };
  if (!previewUrl) return { error: "A preview link is required." };
  const validationError = validateOptionalUrl(pullRequestUrl, "Pull request URL")
    ?? validateOptionalUrl(previewUrl, "Preview URL")
    ?? validateLongText(devNotes ?? "", "Development notes", 10000);
  if (validationError) return { error: validationError };

  const { supabase, userId, role } = await getCurrentRole();
  if (role !== "developer" && role !== "admin" && role !== "project_manager") return { error: "Only the assigned developer or a project manager can complete development." };
  const { data: subtask } = await supabase.from("ticket_subtasks").select("assignee_id, subtask_type").eq("id", subtaskId).eq("ticket_id", ticketId).maybeSingle();
  if (!subtask || subtask.subtask_type !== "dev") return { error: "This is not a development workflow task." };
  if (role === "developer" && subtask.assignee_id !== userId) return { error: "Only the developer assigned to this task can complete it." };

  const { error } = await supabase.from("ticket_subtasks").update({
    is_completed: true,
    dev_pr_url: pullRequestUrl,
    dev_preview_url: previewUrl,
    dev_notes: devNotes,
  }).eq("id", subtaskId).eq("ticket_id", ticketId);
  if (error) {
    if (error.code === "42703" || error.code === "PGRST204") return { error: "Apply migration 20261005040000 before completing development." };
    return { error: "The development handoff could not be saved." };
  }

  const { data: qaStep } = await supabase.from("ticket_subtasks").select("assignee_id").eq("ticket_id", ticketId).eq("subtask_type", "qa").maybeSingle();
  await supabase.from("tickets").update({ preview_url: previewUrl, repository_url: pullRequestUrl, dev_notes: devNotes, status: "in_progress", assignee_id: qaStep?.assignee_id ?? null }).eq("id", ticketId).eq("project_id", projectId);
  revalidatePath(`/projects/${projectId}/tickets/${ticketId}`);
  revalidatePath(`/projects/${projectId}`);
  revalidatePath("/dashboard");
  revalidatePath("/my-tasks");
  return { success: "Development completed and handed off to QA." };
}

export async function updateSubtaskAction(formData: FormData): Promise<void> {
  const projectId = getString(formData, "projectId");
  const ticketId = getString(formData, "ticketId");
  const subtaskId = getString(formData, "subtaskId");
  const title = getString(formData, "title").trim();
  const description = getOptionalString(formData, "description");
  const dueDate = getOptionalString(formData, "dueDate");
  const assigneeValue = getString(formData, "assigneeId");
  const assigneeId = isUuid(assigneeValue) ? assigneeValue : null;
  const estimatedHours = parseOptionalNonnegativeNumber(getString(formData, "estimatedHours"), 100000);
  const loggedHours = parseOptionalNonnegativeNumber(getString(formData, "loggedHours"), 100000);
  if (!isUuid(projectId) || !isUuid(ticketId) || !isUuid(subtaskId)) return;
  if (title.length < 2 || title.length > 200 || (description?.length ?? 0) > 2000 || !isIsoDate(dueDate)) return;
  if (estimatedHours === undefined || loggedHours === undefined) return;

  const { supabase, role } = await getCurrentRole();
  if (!role || role === "client") return;
  const { error } = await supabase
    .from("ticket_subtasks")
    .update({ title, description, due_date: dueDate, assignee_id: assigneeId, estimated_hours: estimatedHours ?? 0, logged_hours: loggedHours ?? 0 })
    .eq("id", subtaskId)
    .eq("ticket_id", ticketId);
  if (error) return;

  revalidatePath(`/projects/${projectId}/tickets/${ticketId}`);
  revalidatePath(`/projects/${projectId}`);
  revalidatePath("/dashboard");
  revalidatePath("/my-tasks");
}

export async function deleteSubtaskAction(formData: FormData): Promise<void> {
  const projectId = getString(formData, "projectId");
  const ticketId = getString(formData, "ticketId");
  const subtaskId = getString(formData, "subtaskId");
  if (!isUuid(projectId) || !isUuid(ticketId) || !isUuid(subtaskId)) return;

  const { supabase, role } = await getCurrentRole();
  if (!role || role === "client") return;
  const { error } = await supabase
    .from("ticket_subtasks")
    .delete()
    .eq("id", subtaskId)
    .eq("ticket_id", ticketId);
  if (error) return;

  revalidatePath(`/projects/${projectId}/tickets/${ticketId}`);
  revalidatePath(`/projects/${projectId}`);
  revalidatePath("/dashboard");
  revalidatePath("/my-tasks");
}
