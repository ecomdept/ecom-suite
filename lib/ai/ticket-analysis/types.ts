export const EXISTS_VERDICTS = ["exists", "partially_exists", "does_not_exist", "unclear"] as const;
export const CONFIDENCE_LEVELS = ["high", "medium", "low"] as const;
export const COMPLEXITY_LEVELS = ["trivial", "small", "medium", "large", "unknown"] as const;

export type ExistsVerdict = (typeof EXISTS_VERDICTS)[number];
export type Confidence = (typeof CONFIDENCE_LEVELS)[number];
export type Complexity = (typeof COMPLEXITY_LEVELS)[number];

export interface CodeCitation {
  path: string;
  start_line: number;
  end_line: number;
  why_relevant: string;
}

export interface ImplementationUseCase {
  title: string;
  detail: string;
  files_to_touch: string[];
  existing_pattern_to_follow: CodeCitation | null;
  acceptance_criteria: string[];
}

export interface EffortEstimate {
  complexity: Complexity;
  estimated_files_touched: number;
  estimated_hours_low: number;
  estimated_hours_high: number;
  rationale: string;
  unknowns: string[];
}

export interface TicketAnalysis {
  schema_version: 1;
  exists_verdict: ExistsVerdict;
  confidence: Confidence;
  tldr: string[];
  verdict_summary: string;
  verdict_reasoning: string;
  evidence: CodeCitation[];
  interpreted_request: string;
  detected_stack: string[];
  implementation_use_cases: ImplementationUseCase[];
  client_facing_docs: string | null;
  effort: EffortEstimate;
  coverage: {
    files_read: string[];
    caveat: string | null;
  };
}

export interface TicketAnalysisRow {
  id: string;
  ticket_id: string;
  project_id: string;
  status: "running" | "complete" | "failed";
  repo_owner: string | null;
  repo_name: string | null;
  git_ref: string | null;
  commit_sha: string | null;
  result: TicketAnalysis | null;
  error_message: string | null;
  model: string | null;
  author_name: string | null;
  created_by: string | null;
  created_at: string;
  completed_at: string | null;
}
