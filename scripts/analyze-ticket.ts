import { execFileSync } from "node:child_process";
import { mkdtemp, readFile, writeFile } from "node:fs/promises";
import { existsSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { loadEnvConfig } from "@next/env";
import { buildAnalysisPrompt } from "@/lib/ai/ticket-analysis/prompt";
import { validateTicketAnalysis } from "@/lib/ai/ticket-analysis/schema";
import type { TicketAnalysis } from "@/lib/ai/ticket-analysis/types";
import { parseGithubRepoUrl } from "@/lib/github/repo-url";
import { isTicketType, isUuid } from "@/lib/projects/validation";
import { createScriptClient } from "./lib/supabase";
import { resolveAgentRunner } from "./lib/agent-runner";

const PROJECT_ROOT = process.cwd();
const REPO_MAP_PATH = path.join(PROJECT_ROOT, "repos.local.json");

class UserFacingError extends Error {}

function parseArgs(argv: string[]) {
  const flags: Record<string, string> = {};
  const positional: string[] = [];

  for (let index = 0; index < argv.length; index += 1) {
    const current = argv[index];
    if (!current.startsWith("--")) {
      positional.push(current);
      continue;
    }
    const key = current.slice(2);
    const next = argv[index + 1];
    if (next && !next.startsWith("--")) {
      flags[key] = next;
      index += 1;
    } else {
      flags[key] = "true";
    }
  }

  return { flags, positional };
}

function extractTicketId(value: string) {
  const trimmed = value.trim();
  if (isUuid(trimmed)) return trimmed;
  const match = /\/tickets\/([0-9a-f-]{36})/i.exec(trimmed);
  return match && isUuid(match[1]) ? match[1] : null;
}

function git(args: string[], cwd: string) {
  return execFileSync("git", args, { cwd, encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] }).trim();
}

function readRepoMap(): Record<string, string> {
  if (!existsSync(REPO_MAP_PATH)) return {};
  try {
    const parsed = JSON.parse(readFileSync(REPO_MAP_PATH, "utf8"));
    return typeof parsed === "object" && parsed !== null ? parsed : {};
  } catch {
    return {};
  }
}

function isGitRepo(candidate: string) {
  return existsSync(path.join(candidate, ".git"));
}

function resolveRepoPath(projectId: string, repoName: string | null, repoArg: string | undefined) {
  if (repoArg) {
    const resolved = path.resolve(repoArg);
    if (!isGitRepo(resolved)) throw new UserFacingError(`"${resolved}" is not a git repository.`);
    return resolved;
  }

  const candidates: string[] = [];
  const remembered = readRepoMap()[projectId];
  if (remembered) candidates.push(remembered);
  if (repoName) {
    if (process.env.ECOM_SUITE_REPOS_DIR) candidates.push(path.join(process.env.ECOM_SUITE_REPOS_DIR, repoName));
    candidates.push(path.resolve(PROJECT_ROOT, "..", repoName));
  }

  for (const candidate of candidates) {
    const resolved = path.resolve(candidate);
    if (isGitRepo(resolved)) return resolved;
  }

  const lookedIn = candidates.length
    ? `\n\nLooked in:\n${candidates.map((candidate) => `  ${path.resolve(candidate)}`).join("\n")}`
    : "";
  throw new UserFacingError(
    `Could not find a local clone${repoName ? ` of ${repoName}` : ""}. Pass the path as a second argument once and it will be remembered for this project.${lookedIn}`,
  );
}

async function rememberRepoPath(projectId: string, repoPath: string) {
  const map = readRepoMap();
  if (map[projectId] === repoPath) return;
  map[projectId] = repoPath;
  await writeFile(REPO_MAP_PATH, `${JSON.stringify(map, null, 2)}\n`, "utf8");
}

function inspectRepo(repoPath: string) {
  const commitSha = git(["rev-parse", "HEAD"], repoPath);
  const branch = git(["rev-parse", "--abbrev-ref", "HEAD"], repoPath);
  const dirty = git(["status", "--porcelain"], repoPath);

  let behind = 0;
  try {
    behind = Number(git(["rev-list", "--count", "HEAD..@{u}"], repoPath)) || 0;
  } catch {
    behind = 0;
  }

  return { commitSha, branch, dirty, behind };
}

async function printProjectTickets(supabase: ReturnType<typeof createScriptClient>, projectId: string) {
  const [{ data: project }, { data: tickets }] = await Promise.all([
    supabase.from("projects").select("name").eq("id", projectId).maybeSingle(),
    supabase
      .from("tickets")
      .select("id, title, status, ticket_type")
      .eq("project_id", projectId)
      .neq("status", "archived")
      .order("created_at", { ascending: false })
      .limit(25),
  ]);

  if (!project) throw new UserFacingError(`No project found with id ${projectId}.`);

  console.log(`That is a project URL, not a ticket URL.\n`);
  if (!tickets?.length) {
    console.log(`"${project.name}" has no open tickets yet.`);
    return;
  }

  console.log(`Open tickets on "${project.name}" — rerun with one of these ids:\n`);
  for (const ticket of tickets) {
    console.log(`  ${ticket.id}  ${ticket.status.padEnd(16)} ${ticket.title}`);
  }
  console.log(`\n  npm run analyze-ticket ${tickets[0].id}`);
}

async function main() {
  loadEnvConfig(PROJECT_ROOT);

  const { flags, positional } = parseArgs(process.argv.slice(2));
  const ticketRef = positional[0] ?? flags.ticket;
  if (!ticketRef || ticketRef === "true") {
    throw new UserFacingError("Usage: npm run analyze-ticket <ticket url> [path to local clone]");
  }
  const repoArg = flags.repo && flags.repo !== "true" ? flags.repo : positional[1];

  const supabase = createScriptClient();

  const ticketId = extractTicketId(ticketRef);
  if (!ticketId) {
    const projectMatch = /\/projects\/([0-9a-f-]{36})\/?$/i.exec(ticketRef.trim());
    if (projectMatch && isUuid(projectMatch[1])) {
      await printProjectTickets(supabase, projectMatch[1]);
      return;
    }
    throw new UserFacingError(`Could not read a ticket id from "${ticketRef}". Paste the ticket URL from the browser.`);
  }

  const { data: ticket, error: ticketError } = await supabase
    .from("tickets")
    .select(
      "id, project_id, title, description, ticket_type, priority, acceptance_criteria, reproduction_steps, expected_behavior, actual_behavior, affected_platforms, reference_url",
    )
    .eq("id", ticketId)
    .maybeSingle();

  if (ticketError) throw new UserFacingError(`Could not load the ticket: ${ticketError.message}`);
  if (!ticket) throw new UserFacingError(`No ticket found with id ${ticketId}.`);
  if (!isTicketType(ticket.ticket_type)) throw new UserFacingError(`Ticket has an unrecognised type "${ticket.ticket_type}".`);

  const { data: project, error: projectError } = await supabase
    .from("projects")
    .select("id, name, description, repository_url, repo_owner, repo_name")
    .eq("id", ticket.project_id)
    .maybeSingle();

  if (projectError) throw new UserFacingError(`Could not load the project: ${projectError.message}`);
  if (!project) throw new UserFacingError("The ticket's project could not be found.");
  if (!project.repository_url) {
    throw new UserFacingError(
      `"${project.name}" has no GitHub repository linked. Add one in project settings before running an analysis.`,
    );
  }

  const repoRef =
    project.repo_owner && project.repo_name
      ? { owner: project.repo_owner, repo: project.repo_name }
      : parseGithubRepoUrl(project.repository_url);

  const userEmail = process.env.ECOM_SUITE_USER_EMAIL;
  if (!userEmail) {
    throw new UserFacingError("ECOM_SUITE_USER_EMAIL is not set. Add your login email to .env.local.");
  }
  const { data: userList, error: userListError } = await supabase.auth.admin.listUsers({ page: 1, perPage: 1000 });
  if (userListError) throw new UserFacingError(`Could not look up your user account: ${userListError.message}`);
  const matchedUser = userList.users.find((user) => user.email?.toLowerCase() === userEmail.toLowerCase());
  if (!matchedUser) {
    throw new UserFacingError(`No user found for ${userEmail}. Check ECOM_SUITE_USER_EMAIL matches your login email.`);
  }

  const repoPath = resolveRepoPath(project.id, repoRef?.repo ?? null, repoArg);
  const before = inspectRepo(repoPath);

  console.log(`Project:  ${project.name}`);
  console.log(`Ticket:   ${ticket.title}`);
  console.log(`Repo:     ${repoPath}`);
  console.log(`Commit:   ${before.commitSha.slice(0, 12)} on ${before.branch}`);

  if (before.dirty) {
    console.warn("\n⚠  This checkout has uncommitted changes. The analysis reflects your working tree, not the branch.");
  }
  if (before.behind > 0) {
    console.warn(`\n⚠  This checkout is ${before.behind} commit(s) behind its upstream. Pull before trusting the result.`);
  }

  const outputDir = await mkdtemp(path.join(tmpdir(), "ecom-suite-analysis-"));
  const outputPath = path.join(outputDir, "analysis.json");
  const runner = resolveAgentRunner();

  console.log(`\nRunning ${runner.name}. This usually takes a minute or two.\n`);

  await runner.run({
    prompt: buildAnalysisPrompt({
      project: { name: project.name, description: project.description },
      ticket: { ...ticket, ticket_type: ticket.ticket_type, affected_platforms: ticket.affected_platforms ?? [] },
      outputPath,
    }),
    cwd: repoPath,
    outputDir,
  });

  const after = inspectRepo(repoPath);
  if (after.commitSha !== before.commitSha || after.dirty !== before.dirty) {
    console.warn("\n⚠  The repository changed during the analysis. Review `git status` — the agent should not modify files.");
  }

  if (!existsSync(outputPath)) {
    throw new UserFacingError(`The agent did not write an analysis to ${outputPath}. Nothing was saved.`);
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(await readFile(outputPath, "utf8"));
  } catch (error) {
    throw new UserFacingError(
      `The agent's output was not valid JSON (${(error as Error).message}). Raw output left at ${outputPath}.`,
    );
  }

  const validationError = validateTicketAnalysis(parsed);
  if (validationError) {
    throw new UserFacingError(`The analysis failed validation: ${validationError}\nRaw output left at ${outputPath}.`);
  }
  const analysis = parsed as TicketAnalysis;

  const { error: insertError } = await supabase.from("ticket_ai_analyses").insert({
    ticket_id: ticket.id,
    project_id: project.id,
    status: "complete",
    repo_owner: repoRef?.owner ?? null,
    repo_name: repoRef?.repo ?? null,
    git_ref: before.branch,
    commit_sha: before.commitSha,
    result: analysis,
    model: runner.name,
    author_name: process.env.ECOM_SUITE_USER_NAME?.trim() || matchedUser.email || null,
    created_by: matchedUser.id,
    completed_at: new Date().toISOString(),
  });

  if (insertError) {
    throw new UserFacingError(
      `The analysis was produced but could not be saved: ${insertError.message}\nRaw output left at ${outputPath}.`,
    );
  }

  await rememberRepoPath(project.id, repoPath);

  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000";
  console.log(`\n${analysis.exists_verdict.replace(/_/g, " ")} (${analysis.confidence} confidence)`);
  console.log(analysis.verdict_summary);
  console.log(`\nSaved to ${siteUrl}/projects/${project.id}/tickets/${ticket.id}`);
}

main().catch((error: unknown) => {
  const message = error instanceof UserFacingError ? error.message : (error as Error).message;
  console.error(`\n${message}`);
  process.exitCode = 1;
});
