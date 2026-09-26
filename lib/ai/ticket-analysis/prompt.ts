import { TICKET_ANALYSIS_SCHEMA } from "@/lib/ai/ticket-analysis/schema";
import type { TicketType } from "@/lib/projects/validation";

export interface AnalysisPromptProject {
  name: string;
  description: string | null;
}

export interface AnalysisPromptTicket {
  title: string;
  description: string | null;
  ticket_type: TicketType;
  priority: string;
  acceptance_criteria: string | null;
  reproduction_steps: string | null;
  expected_behavior: string | null;
  actual_behavior: string | null;
  affected_platforms: string[];
  reference_url: string | null;
}

const TYPE_FRAMING: Record<TicketType, string> = {
  new_feature:
    "This is a NEW FEATURE request. Your main question: does this capability already exist in this codebase, in whole or in part?",
  feature_update:
    "This is a FEATURE UPDATE request. An existing feature is assumed. Find it, confirm what it does today, and describe precisely what would have to change. If you cannot find the feature at all, say so - that is a meaningful finding.",
  bug: "This is a BUG report. Your main question: does the code path the reporter describes exist, and can you see why it would misbehave? Treat 'exists' as meaning the relevant code path is present, and use verdict_reasoning to explain the likely cause.",
};

function section(heading: string, body: string | null) {
  const trimmed = body?.trim();
  return trimmed ? `\n### ${heading}\n${trimmed}\n` : "";
}

export function buildAnalysisPrompt({
  project,
  ticket,
  outputPath,
}: {
  project: AnalysisPromptProject;
  ticket: AnalysisPromptTicket;
  outputPath: string;
}) {
  return `You are analysing a client ticket against the codebase in the current working directory. You have full read access to the repository. Do not modify any file in the repository.

The only file you may write is the output file described at the end.

## The project

**${project.name}**${project.description ? `\n${project.description.trim()}` : ""}

## The ticket

**Title:** ${ticket.title}
**Type:** ${ticket.ticket_type}
**Priority:** ${ticket.priority}${ticket.affected_platforms.length ? `\n**Affected platforms:** ${ticket.affected_platforms.join(", ")}` : ""}${ticket.reference_url ? `\n**Reference:** ${ticket.reference_url}` : ""}
${section("Description", ticket.description)}${section("Desired outcome / acceptance criteria", ticket.acceptance_criteria)}${section("Steps to reproduce", ticket.reproduction_steps)}${section("Expected behaviour", ticket.expected_behavior)}${section("Actual behaviour", ticket.actual_behavior)}
${TYPE_FRAMING[ticket.ticket_type]}

## What to produce

0. **A TLDR** - 3 to 5 bullets that are the entire answer at a glance. This is the only part most people will read, so it carries the most weight. Rules, and they are strict because every analysis must look the same:
   - Exactly 3 to 5 bullets. Never fewer, never more.
   - Each bullet is ONE short plain sentence, under 140 characters.
   - No markdown, no bold, no file paths, no function names, no jargon. A project manager who has never seen the code must understand every bullet.
   - Bullet 1 states the verdict in plain words. For example "This already works on product pages today." or "This does not exist yet and needs to be built."
   - The remaining bullets cover what that means for the client and what happens next - scope, effort, and anything that would change the answer.
   - Write them so they still make sense pasted into a ticket on their own, with no other context.

1. **A verdict** on whether the requested capability already exists, backed by citations to code you have actually read.
2. **Implementation use cases** when it does not exist - grounded in this repository's real files and conventions.
3. **A client-facing explanation** when it does exist - plain language, no jargon, suitable for a non-technical client.
4. **An effort estimate** to help with sprint planning.

## Rules that matter most

**The ticket was probably written by a non-technical client.** Before anything else, restate what they are asking for in developer terms. Put that in \`interpreted_request\`. Then decide what code would satisfy it.

**A citation is only valid if you opened that file and read those lines in this session.** Never cite a path you only saw in a search result list or a directory listing. Never construct a plausible-looking path. Every path in \`evidence\` must also appear in \`coverage.files_read\`, and that will be checked.

**A matching name is not a matching feature.** A file called \`size-guide.liquid\` proves a file exists. It does not prove the behaviour the client described works. Read the implementation and confirm the behaviour before answering "exists".

**Empty search results are weak evidence.** A wrong query looks exactly like a missing feature. Before concluding \`does_not_exist\`, you must have (a) listed the directory where such a feature would live given this repository's conventions, and (b) tried at least two different vocabularies - the client's words and the words a developer on this codebase would use.

**Every use case must name real files from this repository** and reference a real existing pattern to follow. If you cannot name the files, you have not explored enough. Generic advice such as "create a new component and add tests" is a failed answer.

**Do not be agreeable.** \`unclear\` with \`confidence: "low"\` is a correct and useful answer. Guessing is not. You are not rewarded for having an opinion.

## Verdict rubric

- \`exists\` - you read code that implements the requested behaviour end to end.
- \`partially_exists\` - a related mechanism exists but not the requested behaviour. Say precisely what is missing.
- \`does_not_exist\` - you searched the right places with the right terms and found nothing.
- \`unclear\` - you ran out of road, or the repository layout defeated you. Explain what blocked you in \`coverage.caveat\`.

Confidence: \`high\` means you read the implementing code directly. \`medium\` means strong circumstantial evidence. \`low\` means thin or blocked.

## Output

When you are done, write your analysis as JSON to exactly this path:

\`${outputPath}\`

Write nothing else to disk. The file must contain only the JSON object - no markdown fences, no commentary. It must conform to this JSON Schema:

\`\`\`json
${JSON.stringify(TICKET_ANALYSIS_SCHEMA, null, 2)}
\`\`\`

Set \`client_facing_docs\` to null when the verdict is \`does_not_exist\` or \`unclear\`. Populate \`implementation_use_cases\` when the feature does not exist (required), and when a feature update needs work. List every file you opened in \`coverage.files_read\`.

Before you write the file, re-read your \`tldr\`. If any bullet contains a file path, a code identifier, markdown syntax, or runs over 140 characters, rewrite it. If there are fewer than 3 or more than 5 bullets, fix the count. The detailed fields below it are where technical depth belongs - the TLDR stays plain.
`;
}
