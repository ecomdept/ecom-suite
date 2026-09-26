"use client";

import { useActionState } from "react";
import { ChevronRight, ExternalLink, Loader2, Send, Sparkles, Trash2 } from "lucide-react";
import { deleteTicketAnalysisAction, publishClientSummaryAction } from "@/app/projects/ai-actions";
import { FormMessage } from "@/components/auth/form-message";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { MarkdownContent } from "@/components/ui/markdown-content";
import type { ProjectActionState } from "@/app/projects/actions";
import type { CodeCitation, ExistsVerdict, TicketAnalysisRow } from "@/lib/ai/ticket-analysis/types";
import { buildBlobUrl } from "@/lib/github/repo-url";

const initialState: ProjectActionState = {};

const verdictDetails: Record<ExistsVerdict, { label: string; classes: string }> = {
  exists: { label: "Already exists", classes: "bg-emerald-50 text-emerald-700" },
  partially_exists: { label: "Partially exists", classes: "bg-amber-50 text-amber-700" },
  does_not_exist: { label: "Not built yet", classes: "bg-blue-50 text-blue-700" },
  unclear: { label: "Unclear", classes: "bg-stone-100 text-slate-600" },
};

const confidenceClasses: Record<string, string> = {
  high: "bg-emerald-50 text-emerald-700",
  medium: "bg-amber-50 text-amber-700",
  low: "bg-red-50 text-red-700",
};

function formatDateTime(value: string) {
  return new Intl.DateTimeFormat("en", { dateStyle: "medium", timeStyle: "short", timeZone: "UTC" }).format(new Date(value));
}

function Citation({ analysis, citation }: { analysis: TicketAnalysisRow; citation: CodeCitation }) {
  const label = `${citation.path}:${citation.start_line}${citation.end_line > citation.start_line ? `-${citation.end_line}` : ""}`;
  if (!analysis.repo_owner || !analysis.repo_name || !analysis.commit_sha) {
    return <span className="font-mono text-xs text-slate-600">{label}</span>;
  }
  return (
    <a
      className="inline-flex items-center gap-1 font-mono text-xs font-medium text-pink-600 hover:text-pink-500"
      href={buildBlobUrl(analysis.repo_owner, analysis.repo_name, analysis.commit_sha, citation.path, citation.start_line, citation.end_line)}
      rel="noreferrer"
      target="_blank"
    >
      {label}
      <ExternalLink aria-hidden="true" className="size-3" />
    </a>
  );
}

function Disclosure({ title, count, children }: { title: string; count?: number; children: React.ReactNode }) {
  return (
    <details className="group rounded-xl border border-stone-200">
      <summary className="flex cursor-pointer list-none items-center gap-2 px-4 py-3 text-sm font-medium marker:hidden">
        <ChevronRight aria-hidden="true" className="size-4 text-slate-400 transition-transform group-open:rotate-90" />
        {title}
        {count !== undefined && <span className="text-xs font-normal text-slate-400">({count})</span>}
      </summary>
      <div className="border-t border-stone-100 p-4">{children}</div>
    </details>
  );
}

export function TicketAnalysisPanel({
  projectId,
  ticketId,
  analysis,
  clientSummary,
  canManage,
}: {
  projectId: string;
  ticketId: string;
  analysis: TicketAnalysisRow | null;
  clientSummary: string | null;
  canManage: boolean;
}) {
  const [publishState, publishAction, publishPending] = useActionState(publishClientSummaryAction, initialState);
  const [deleteState, deleteAction, deletePending] = useActionState(deleteTicketAnalysisAction, initialState);

  if (!analysis || !analysis.result) {
    return (
      <section className="rounded-2xl border border-stone-200 bg-white p-5 shadow-sm sm:p-7" aria-labelledby="use-cases-heading">
        <div className="flex items-center gap-3">
          <span className="grid size-9 place-items-center rounded-xl bg-pink-50 text-pink-600"><Sparkles aria-hidden="true" className="size-4" /></span>
          <h2 className="text-lg font-semibold" id="use-cases-heading">Use Cases</h2>
        </div>
        <p className="mt-3 text-sm text-slate-500">
          No analysis yet. A developer with the repository cloned locally can run one:
        </p>
        <pre className="mt-3 overflow-x-auto rounded-xl bg-slate-950 p-4 text-xs leading-6 text-slate-100"><code>npm run analyze-ticket {ticketId}</code></pre>
      </section>
    );
  }

  const result = analysis.result;
  const verdict = verdictDetails[result.exists_verdict];
  const tldr = Array.isArray(result.tldr) && result.tldr.length ? result.tldr : [result.verdict_summary];
  const tldrMarkdown = tldr.map((bullet) => `- ${bullet}`).join("\n");

  return (
    <section className="overflow-hidden rounded-2xl border border-stone-200 bg-white shadow-sm" aria-labelledby="use-cases-heading">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-stone-100 px-5 py-5 sm:px-7">
        <div className="flex items-center gap-3">
          <span className="grid size-9 place-items-center rounded-xl bg-pink-50 text-pink-600"><Sparkles aria-hidden="true" className="size-4" /></span>
          <h2 className="text-lg font-semibold" id="use-cases-heading">Use Cases</h2>
        </div>
        <div className="flex flex-wrap items-center gap-2 text-xs">
          <span className={`rounded-md px-2.5 py-1 font-medium ${verdict.classes}`}>{verdict.label}</span>
          <span className={`rounded-md px-2.5 py-1 font-medium ${confidenceClasses[result.confidence]}`}>{result.confidence} confidence</span>
        </div>
      </div>

      <div className="grid gap-5 p-5 sm:p-7">
        <ul className="grid gap-2.5">
          {tldr.map((bullet, index) => (
            <li className="flex gap-3 text-sm leading-6 text-slate-800" key={`${bullet}-${index}`}>
              <span aria-hidden="true" className="mt-2 size-1.5 shrink-0 rounded-full bg-pink-500" />
              {bullet}
            </li>
          ))}
        </ul>

        <div className="flex flex-wrap gap-2 text-xs">
          <span className="rounded-md bg-stone-100 px-2.5 py-1 font-medium capitalize text-slate-700">{result.effort.complexity}</span>
          <span className="rounded-md bg-stone-100 px-2.5 py-1 font-medium text-slate-700">{result.effort.estimated_hours_low}–{result.effort.estimated_hours_high}h</span>
          <span className="rounded-md bg-stone-100 px-2.5 py-1 font-medium text-slate-700">{result.effort.estimated_files_touched} file(s)</span>
        </div>

        {result.coverage.caveat && (
          <p className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">{result.coverage.caveat}</p>
        )}

        <div className="grid gap-2">
          <Disclosure title="Reasoning">
            <p className="text-xs font-medium uppercase tracking-wide text-slate-400">Read as</p>
            <p className="mt-1.5 text-sm leading-6 text-slate-700">{result.interpreted_request}</p>
            <MarkdownContent className="mt-4" content={result.verdict_reasoning} />
            {result.detected_stack.length > 0 && (
              <div className="mt-4 flex flex-wrap gap-2">
                {result.detected_stack.map((item) => (
                  <span className="rounded-md bg-stone-100 px-2 py-1 text-xs text-slate-600" key={item}>{item}</span>
                ))}
              </div>
            )}
          </Disclosure>

          {result.evidence.length > 0 && (
            <Disclosure count={result.evidence.length} title="Code references">
              <ul className="grid gap-3">
                {result.evidence.map((citation, index) => (
                  <li key={`${citation.path}-${citation.start_line}-${index}`}>
                    <Citation analysis={analysis} citation={citation} />
                    <p className="mt-1 text-sm text-slate-600">{citation.why_relevant}</p>
                  </li>
                ))}
              </ul>
            </Disclosure>
          )}

          {result.implementation_use_cases.length > 0 && (
            <Disclosure count={result.implementation_use_cases.length} title="Implementation detail">
              <div className="grid gap-4">
                {result.implementation_use_cases.map((useCase, index) => (
                  <article className="border-b border-stone-100 pb-4 last:border-0 last:pb-0" key={`${useCase.title}-${index}`}>
                    <h4 className="text-sm font-medium text-slate-900">{useCase.title}</h4>
                    <MarkdownContent className="mt-2" content={useCase.detail} />
                    <div className="mt-3 flex flex-wrap gap-2">
                      {useCase.files_to_touch.map((file) => (
                        <span className="rounded-md bg-stone-100 px-2 py-1 font-mono text-xs text-slate-700" key={file}>{file}</span>
                      ))}
                    </div>
                    {useCase.existing_pattern_to_follow && (
                      <p className="mt-3 text-xs text-slate-500">
                        Pattern to follow: <Citation analysis={analysis} citation={useCase.existing_pattern_to_follow} />
                      </p>
                    )}
                    {useCase.acceptance_criteria.length > 0 && (
                      <ul className="mt-3 list-disc space-y-1 pl-5 text-sm text-slate-700">
                        {useCase.acceptance_criteria.map((criterion, criterionIndex) => (
                          <li key={`${criterion}-${criterionIndex}`}>{criterion}</li>
                        ))}
                      </ul>
                    )}
                  </article>
                ))}
              </div>
            </Disclosure>
          )}

          {result.effort.unknowns.length > 0 && (
            <Disclosure count={result.effort.unknowns.length} title="What could change the estimate">
              <MarkdownContent content={result.effort.rationale} />
              <ul className="mt-3 list-disc space-y-1 pl-5 text-sm text-slate-600">
                {result.effort.unknowns.map((unknown, index) => <li key={`${unknown}-${index}`}>{unknown}</li>)}
              </ul>
            </Disclosure>
          )}
        </div>

        {canManage && (
          <form action={publishAction} className="grid gap-3 rounded-xl border border-stone-200 bg-slate-50/60 p-4">
            <input name="projectId" type="hidden" value={projectId} />
            <input name="ticketId" type="hidden" value={ticketId} />
            <div>
              <Label htmlFor="client-summary">Publish to the ticket</Label>
              <p className="mt-1 text-xs text-slate-500">Review and edit before publishing. Everyone on the ticket sees this, including the client.</p>
            </div>
            <textarea
              className="min-h-28 w-full rounded-md border border-input bg-white p-3 font-mono text-xs leading-5"
              defaultValue={clientSummary ?? tldrMarkdown}
              id="client-summary"
              maxLength={4000}
              name="clientSummary"
              placeholder="Nothing published on this ticket yet."
            />
            <FormMessage error={publishState.error} success={publishState.success} />
            <Button className="justify-self-start" disabled={publishPending} type="submit" variant="outline">
              {publishPending ? <Loader2 aria-hidden="true" className="animate-spin" /> : <Send aria-hidden="true" />}
              {publishPending ? "Publishing…" : "Publish"}
            </Button>
          </form>
        )}

        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-stone-100 pt-4 text-xs text-slate-400">
          <p>
            Analysed {formatDateTime(analysis.created_at)} UTC
            {analysis.author_name ? ` by ${analysis.author_name}` : ""}
            {analysis.commit_sha ? <> · <span className="font-mono">{analysis.commit_sha.slice(0, 7)}</span>{analysis.git_ref ? ` on ${analysis.git_ref}` : ""}</> : null}
          </p>
          {canManage && (
            <form action={deleteAction}>
              <input name="projectId" type="hidden" value={projectId} />
              <input name="ticketId" type="hidden" value={ticketId} />
              <input name="analysisId" type="hidden" value={analysis.id} />
              <Button className="text-slate-500" disabled={deletePending} size="sm" type="submit" variant="ghost">
                {deletePending ? <Loader2 aria-hidden="true" className="animate-spin" /> : <Trash2 aria-hidden="true" />}
                Delete
              </Button>
            </form>
          )}
        </div>
        <FormMessage error={deleteState.error} success={deleteState.success} />
      </div>
    </section>
  );
}
