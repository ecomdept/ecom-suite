"use server";

import { requireUser } from "@/lib/auth/session";

export type GlobalSearchResult = {
  id: string;
  type: "project" | "ticket" | "subtask" | "user";
  title: string;
  detail: string;
  href?: string;
};

export type GlobalSearchResponse = {
  results: GlobalSearchResult[];
  error?: string;
};

function normalizeSearchTerm(query: string) {
  return query.replace(/[^\p{L}\p{N}\s-]/gu, " ").replace(/\s+/g, " ").trim().slice(0, 80);
}

export async function globalSearchAction(query: string): Promise<GlobalSearchResponse> {
  const term = normalizeSearchTerm(query);
  if (term.length < 2) return { results: [] };

  const { supabase, claims } = await requireUser();
  const userId = typeof claims.sub === "string" ? claims.sub : "";
  const { data: roleRecord } = await supabase.from("user_roles").select("role").eq("user_id", userId).maybeSingle();
  if (roleRecord?.role === "client") return { results: [], error: "Search is not available for client accounts." };

  const pattern = `%${term}%`;
  const [{ data: projects }, { data: tickets }, { data: subtasks }, { data: profiles }] = await Promise.all([
    supabase.from("projects").select("id, name, description").or(`name.ilike.${pattern},description.ilike.${pattern}`).limit(5),
    supabase.from("tickets").select("id, project_id, title, status").or(`title.ilike.${pattern},description.ilike.${pattern},dev_notes.ilike.${pattern}`).limit(6),
    supabase.from("ticket_subtasks").select("id, ticket_id, title, is_completed").or(`title.ilike.${pattern},description.ilike.${pattern}`).limit(5),
    supabase.from("profiles").select("id, full_name").ilike("full_name", pattern).limit(5),
  ]);

  const subtaskTicketIds = [...new Set((subtasks ?? []).map((subtask) => subtask.ticket_id))];
  const { data: subtaskParents } = subtaskTicketIds.length
    ? await supabase.from("tickets").select("id, project_id, title").in("id", subtaskTicketIds)
    : { data: [] };
  const parentById = new Map(subtaskParents?.map((ticket) => [ticket.id, ticket]));
  const projectIds = [...new Set([
    ...(tickets ?? []).map((ticket) => ticket.project_id),
    ...(subtaskParents ?? []).map((ticket) => ticket.project_id),
  ])];
  const { data: relatedProjects } = projectIds.length
    ? await supabase.from("projects").select("id, name").in("id", projectIds)
    : { data: [] };
  const projectById = new Map([
    ...(projects ?? []).map((project) => [project.id, project.name] as const),
    ...(relatedProjects ?? []).map((project) => [project.id, project.name] as const),
  ]);

  const results: GlobalSearchResult[] = [
    ...(projects ?? []).map((project) => ({ id: project.id, type: "project" as const, title: project.name, detail: project.description || "Project", href: `/projects/${project.id}` })),
    ...(tickets ?? []).map((ticket) => ({ id: ticket.id, type: "ticket" as const, title: ticket.title, detail: `${projectById.get(ticket.project_id) || "Project"} · ${String(ticket.status).replace("_", " ")}`, href: `/projects/${ticket.project_id}/tickets/${ticket.id}` })),
    ...(subtasks ?? []).flatMap((subtask) => {
      const parent = parentById.get(subtask.ticket_id);
      if (!parent) return [];
      return [{ id: subtask.id, type: "subtask" as const, title: subtask.title, detail: `${projectById.get(parent.project_id) || "Project"} · ${parent.title}`, href: `/projects/${parent.project_id}/tickets/${parent.id}#subtask-${subtask.id}` }];
    }),
    ...(profiles ?? []).map((profile) => ({ id: profile.id, type: "user" as const, title: profile.full_name || "Workspace user", detail: profile.id === userId ? "You" : "Project collaborator", href: roleRecord?.role === "admin" ? `/dashboard#user-${profile.id}` : profile.id === userId ? "/dashboard#profile-heading" : undefined })),
  ];

  return { results: results.slice(0, 18) };
}
