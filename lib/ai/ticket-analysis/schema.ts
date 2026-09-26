import { COMPLEXITY_LEVELS, CONFIDENCE_LEVELS, EXISTS_VERDICTS, type TicketAnalysis } from "@/lib/ai/ticket-analysis/types";

const CITATION_SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: ["path", "start_line", "end_line", "why_relevant"],
  properties: {
    path: { type: "string", description: "Repo-relative path of a file you actually opened and read." },
    start_line: { type: "integer" },
    end_line: { type: "integer" },
    why_relevant: { type: "string", description: "One sentence, plain text." },
  },
} as const;

export const TICKET_ANALYSIS_SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: [
    "schema_version",
    "exists_verdict",
    "confidence",
    "tldr",
    "verdict_summary",
    "verdict_reasoning",
    "evidence",
    "interpreted_request",
    "detected_stack",
    "implementation_use_cases",
    "client_facing_docs",
    "effort",
    "coverage",
  ],
  properties: {
    schema_version: { const: 1 },
    exists_verdict: { enum: EXISTS_VERDICTS },
    confidence: { enum: CONFIDENCE_LEVELS },
    tldr: {
      type: "array",
      items: { type: "string" },
      description:
        "Exactly 3 to 5 bullets. Each is one short plain sentence under 140 characters, no markdown, no file paths, no jargon. Bullet 1 states the verdict. The rest cover what this means and what happens next. A PM must understand the whole answer from these alone.",
    },
    verdict_summary: { type: "string", description: "One or two plain sentences a non-technical PM can read." },
    verdict_reasoning: { type: "string", description: "Markdown. Reference files by name." },
    evidence: { type: "array", items: CITATION_SCHEMA },
    interpreted_request: { type: "string", description: "The client's request restated in developer terms." },
    detected_stack: { type: "array", items: { type: "string" } },
    implementation_use_cases: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        required: ["title", "detail", "files_to_touch", "existing_pattern_to_follow", "acceptance_criteria"],
        properties: {
          title: { type: "string" },
          detail: { type: "string", description: "Markdown." },
          files_to_touch: { type: "array", items: { type: "string" } },
          existing_pattern_to_follow: { anyOf: [CITATION_SCHEMA, { type: "null" }] },
          acceptance_criteria: { type: "array", items: { type: "string" } },
        },
      },
    },
    client_facing_docs: {
      anyOf: [{ type: "string" }, { type: "null" }],
      description: "Markdown for the client when the feature exists. Null when it does not.",
    },
    effort: {
      type: "object",
      additionalProperties: false,
      required: [
        "complexity",
        "estimated_files_touched",
        "estimated_hours_low",
        "estimated_hours_high",
        "rationale",
        "unknowns",
      ],
      properties: {
        complexity: { enum: COMPLEXITY_LEVELS },
        estimated_files_touched: { type: "integer" },
        estimated_hours_low: { type: "number" },
        estimated_hours_high: { type: "number" },
        rationale: { type: "string", description: "Markdown." },
        unknowns: { type: "array", items: { type: "string" } },
      },
    },
    coverage: {
      type: "object",
      additionalProperties: false,
      required: ["files_read", "caveat"],
      properties: {
        files_read: {
          type: "array",
          items: { type: "string" },
          description: "Every repo-relative path you opened. Each evidence citation must appear here.",
        },
        caveat: {
          anyOf: [{ type: "string" }, { type: "null" }],
          description: "Anything that limited this analysis, or null.",
        },
      },
    },
  },
} as const;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isNonEmptyString(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0;
}

function isStringArray(value: unknown): value is string[] {
  return Array.isArray(value) && value.every((entry) => typeof entry === "string");
}

function validateCitation(value: unknown, label: string) {
  if (!isRecord(value)) return `${label} must be an object.`;
  if (!isNonEmptyString(value.path)) return `${label}.path must be a non-empty string.`;
  if (!Number.isInteger(value.start_line) || (value.start_line as number) < 1) {
    return `${label}.start_line must be a positive integer.`;
  }
  if (!Number.isInteger(value.end_line) || (value.end_line as number) < (value.start_line as number)) {
    return `${label}.end_line must be an integer greater than or equal to start_line.`;
  }
  if (!isNonEmptyString(value.why_relevant)) return `${label}.why_relevant must be a non-empty string.`;
  return null;
}

export function validateTicketAnalysis(value: unknown): string | null {
  if (!isRecord(value)) return "Analysis must be a JSON object.";
  if (value.schema_version !== 1) return "schema_version must be 1.";
  if (!EXISTS_VERDICTS.includes(value.exists_verdict as never)) {
    return `exists_verdict must be one of: ${EXISTS_VERDICTS.join(", ")}.`;
  }
  if (!CONFIDENCE_LEVELS.includes(value.confidence as never)) {
    return `confidence must be one of: ${CONFIDENCE_LEVELS.join(", ")}.`;
  }
  if (!isStringArray(value.tldr)) return "tldr must be an array of strings.";
  if (value.tldr.length < 3 || value.tldr.length > 5) {
    return `tldr must have between 3 and 5 bullets (got ${value.tldr.length}).`;
  }
  for (const [index, bullet] of value.tldr.entries()) {
    if (!isNonEmptyString(bullet)) return `tldr[${index}] must be a non-empty string.`;
    if (bullet.length > 140) return `tldr[${index}] must be 140 characters or less (got ${bullet.length}).`;
  }
  if (!isNonEmptyString(value.verdict_summary)) return "verdict_summary must be a non-empty string.";
  if (!isNonEmptyString(value.verdict_reasoning)) return "verdict_reasoning must be a non-empty string.";
  if (!isNonEmptyString(value.interpreted_request)) return "interpreted_request must be a non-empty string.";
  if (!isStringArray(value.detected_stack)) return "detected_stack must be an array of strings.";
  if (value.client_facing_docs !== null && !isNonEmptyString(value.client_facing_docs)) {
    return "client_facing_docs must be a non-empty string or null.";
  }

  if (!isRecord(value.coverage)) return "coverage must be an object.";
  if (!isStringArray(value.coverage.files_read)) return "coverage.files_read must be an array of strings.";
  if (value.coverage.caveat !== null && !isNonEmptyString(value.coverage.caveat)) {
    return "coverage.caveat must be a non-empty string or null.";
  }
  const filesRead = new Set(value.coverage.files_read);

  if (!Array.isArray(value.evidence)) return "evidence must be an array.";
  for (const [index, citation] of value.evidence.entries()) {
    const error = validateCitation(citation, `evidence[${index}]`);
    if (error) return error;
    const path = (citation as { path: string }).path;
    if (!filesRead.has(path)) {
      return `evidence[${index}].path "${path}" is not listed in coverage.files_read, so it was not actually read.`;
    }
  }
  if (value.exists_verdict !== "unclear" && value.evidence.length === 0) {
    return `A verdict of "${value.exists_verdict}" requires at least one evidence citation.`;
  }

  if (!Array.isArray(value.implementation_use_cases)) return "implementation_use_cases must be an array.";
  for (const [index, useCase] of value.implementation_use_cases.entries()) {
    const label = `implementation_use_cases[${index}]`;
    if (!isRecord(useCase)) return `${label} must be an object.`;
    if (!isNonEmptyString(useCase.title)) return `${label}.title must be a non-empty string.`;
    if (!isNonEmptyString(useCase.detail)) return `${label}.detail must be a non-empty string.`;
    if (!isStringArray(useCase.files_to_touch) || useCase.files_to_touch.length === 0) {
      return `${label}.files_to_touch must be a non-empty array of repo-relative paths.`;
    }
    if (!isStringArray(useCase.acceptance_criteria)) {
      return `${label}.acceptance_criteria must be an array of strings.`;
    }
    if (useCase.existing_pattern_to_follow !== null) {
      const error = validateCitation(useCase.existing_pattern_to_follow, `${label}.existing_pattern_to_follow`);
      if (error) return error;
    }
  }
  if (value.exists_verdict === "does_not_exist" && value.implementation_use_cases.length === 0) {
    return 'A verdict of "does_not_exist" requires at least one implementation use case.';
  }

  const effort = value.effort;
  if (!isRecord(effort)) return "effort must be an object.";
  if (!COMPLEXITY_LEVELS.includes(effort.complexity as never)) {
    return `effort.complexity must be one of: ${COMPLEXITY_LEVELS.join(", ")}.`;
  }
  if (!Number.isInteger(effort.estimated_files_touched) || (effort.estimated_files_touched as number) < 0) {
    return "effort.estimated_files_touched must be a non-negative integer.";
  }
  const low = effort.estimated_hours_low;
  const high = effort.estimated_hours_high;
  if (typeof low !== "number" || !Number.isFinite(low) || low < 0) {
    return "effort.estimated_hours_low must be a non-negative number.";
  }
  if (typeof high !== "number" || !Number.isFinite(high) || high < low) {
    return "effort.estimated_hours_high must be a number greater than or equal to estimated_hours_low.";
  }
  if (!isNonEmptyString(effort.rationale)) return "effort.rationale must be a non-empty string.";
  if (!isStringArray(effort.unknowns)) return "effort.unknowns must be an array of strings.";

  return null;
}

export function asTicketAnalysis(value: unknown): TicketAnalysis | null {
  return validateTicketAnalysis(value) === null ? (value as TicketAnalysis) : null;
}
