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
  isCurrency,
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

function isIsoDate(value: string | null) {
  return value === null || /^\d{4}-\d{2}-\d{2}$/.test(value);
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

export async function createProjectAction(
  previousState: ProjectActionState,
  formData: FormData,
): Promise<ProjectActionState> {
  void previousState;
  const name = getString(formData, "name").trim();
  const description = getString(formData, "description").trim();
  const memberIds = [...new Set(formData.getAll("members").map(String).filter(isUuid))];
  const retainerHours = parseOptionalNonnegativeNumber(getString(formData, "retainerHours"), 100000);
  const budgetAmount = parseOptionalNonnegativeNumber(getString(formData, "budgetAmount"), 1000000000);
  const currency = getString(formData, "currency").trim().toUpperCase() || "USD";
  const validationError = validateProjectName(name) ?? validateDescription(description);

  if (validationError) return { error: validationError };
  if (retainerHours === undefined) return { error: "Enter a valid retainer amount." };
  if (budgetAmount === undefined) return { error: "Enter a valid project budget." };
  if (!isCurrency(currency)) return { error: "Currency must be a three-letter code such as USD." };

  const { supabase, userId, role } = await getCurrentRole();
  if (role !== "admin") return { error: "Only administrators can create projects." };

  const { data: project, error: projectError } = await supabase
    .from("projects")
    .insert({
      name,
      description: description || null,
      created_by: userId,
      retainer_hours: retainerHours,
      budget_amount: budgetAmount,
      currency,
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
    return {
      error: "The project was created, but its members could not be assigned. Open the project and try again.",
    };
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
  revalidatePath("/my-tasks");
  return { success: "Ticket added to the backlog." };
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

  const { error } = await supabase.from("projects").delete().eq("id", projectId);
  if (error) return { error: "The project could not be deleted." };

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
  const desiredMemberIds = [...new Set(formData.getAll("members").map(String).filter(isUuid))];
  if (!isUuid(projectId)) return { error: "Invalid project." };

  const { supabase, userId, role } = await getCurrentRole();
  if (role !== "admin") return { error: "Only administrators can manage project access." };

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
  const retainerHours = parseOptionalNonnegativeNumber(getString(formData, "retainerHours"), 100000);
  const budgetAmount = parseOptionalNonnegativeNumber(getString(formData, "budgetAmount"), 1000000000);
  const currency = getString(formData, "currency").trim().toUpperCase();
  const periodStart = getString(formData, "periodStart") || null;
  const periodEnd = getString(formData, "periodEnd") || null;

  if (!isUuid(projectId)) return { error: "Invalid project." };
  if (retainerHours === undefined) return { error: "Enter valid retainer hours." };
  if (budgetAmount === undefined) return { error: "Enter a valid budget." };
  if (!isCurrency(currency)) return { error: "Currency must be a three-letter code such as USD." };
  if (periodStart && periodEnd && periodEnd < periodStart) {
    return { error: "The period end date must be on or after the start date." };
  }

  const { supabase, role } = await getCurrentRole();
  if (role !== "admin") return { error: "Only administrators can update project settings." };

  const { error } = await supabase
    .from("projects")
    .update({
      retainer_hours: retainerHours,
      budget_amount: budgetAmount,
      currency,
      retainer_period_start: periodStart,
      retainer_period_end: periodEnd,
    })
    .eq("id", projectId);
  if (error) return { error: "Project settings could not be updated." };

  revalidatePath(`/projects/${projectId}`);
  revalidatePath("/projects");
  return { success: "Retainer and budget settings updated." };
}

export async function updateTicketUsageAction(
  previousState: ProjectActionState,
  formData: FormData,
): Promise<ProjectActionState> {
  void previousState;
  const projectId = getString(formData, "projectId");
  const ticketId = getString(formData, "ticketId");
  const estimatedHours = parseOptionalNonnegativeNumber(getString(formData, "estimatedHours"), 100000);
  const loggedHours = parseOptionalNonnegativeNumber(getString(formData, "loggedHours"), 100000);
  const billableAmount = parseOptionalNonnegativeNumber(getString(formData, "billableAmount"), 1000000000);

  if (!isUuid(projectId) || !isUuid(ticketId)) return { error: "Invalid ticket." };
  if (estimatedHours === undefined || loggedHours === undefined || billableAmount === undefined) {
    return { error: "Hours and billable amount must be valid nonnegative numbers." };
  }

  const { supabase, role } = await getCurrentRole();
  if (role !== "admin" && role !== "project_manager") {
    return { error: "You do not have permission to update ticket usage." };
  }

  const { error } = await supabase
    .from("tickets")
    .update({
      estimated_hours: estimatedHours ?? 0,
      logged_hours: loggedHours ?? 0,
      billable_amount: billableAmount ?? 0,
    })
    .eq("id", ticketId)
    .eq("project_id", projectId);
  if (error) return { error: "Ticket usage could not be updated." };

  revalidatePath(`/projects/${projectId}`);
  revalidatePath(`/projects/${projectId}/tickets/${ticketId}`);
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
  const { error } = await supabase
    .from("ticket_subtasks")
    .update({ is_completed: isCompleted })
    .eq("id", subtaskId)
    .eq("ticket_id", ticketId);
  if (error) return;

  revalidatePath(`/projects/${projectId}/tickets/${ticketId}`);
  revalidatePath("/my-tasks");
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
  revalidatePath("/my-tasks");
}
