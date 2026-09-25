import Link from "next/link";
import { Archive } from "lucide-react";

export type ArchivedTicketRow = {
  id: string;
  title: string;
  archivedAt: string;
  estimatedHours: number;
  loggedHours: number;
};

function formatMonth(value: string) {
  return new Intl.DateTimeFormat("en", {
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  }).format(new Date(value));
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat("en", {
    month: "short",
    day: "numeric",
    year: "numeric",
    timeZone: "UTC",
  }).format(new Date(value));
}

function formatHours(value: number) {
  return value.toLocaleString("en-US", { maximumFractionDigits: 2 });
}

export function ArchivedTicketList({
  projectId,
  tickets,
  clientView = false,
}: {
  projectId: string;
  tickets: ArchivedTicketRow[];
  clientView?: boolean;
}) {
  const sortedTickets = [...tickets].sort(
    (left, right) =>
      right.archivedAt.localeCompare(left.archivedAt) ||
      left.title.localeCompare(right.title),
  );
  const ticketsByMonth = new Map<string, ArchivedTicketRow[]>();

  sortedTickets.forEach((ticket) => {
    const month = ticket.archivedAt.slice(0, 7);
    ticketsByMonth.set(month, [...(ticketsByMonth.get(month) ?? []), ticket]);
  });

  return (
    <section aria-labelledby="archive-heading" className="mt-12">
      <div className="mb-4 flex items-end justify-between gap-4">
        <div>
          <p className="eyebrow">History</p>
          <h2 className="font-display mt-2 text-3xl leading-none" id="archive-heading">
            {clientView ? "Delivered archive" : "Archived tasks"}
          </h2>
          <p className="mt-2 text-sm text-slate-500">
            {clientView
              ? "Previously delivered requests organized by month."
              : "Completed work organized by the month it was archived."}
          </p>
        </div>
        <span className="rounded-full bg-stone-200 px-3 py-1 text-xs font-semibold text-slate-600">
          {tickets.length}
        </span>
      </div>

      {ticketsByMonth.size > 0 ? (
        <div className="grid gap-6">
          {[...ticketsByMonth.entries()].map(([month, monthTickets]) => (
            <section
              className="overflow-hidden rounded-2xl border border-stone-200 bg-white shadow-sm"
              key={month}
            >
              <div className="flex items-center justify-between border-b border-stone-100 bg-slate-50/70 px-5 py-4 sm:px-7">
                <h3 className="font-semibold">{formatMonth(monthTickets[0].archivedAt)}</h3>
                <span className="text-xs text-slate-500">
                  {monthTickets.length} {monthTickets.length === 1 ? "task" : "tasks"}
                </span>
              </div>
              <div className={`hidden border-b border-stone-100 px-7 py-3 text-[10px] font-semibold uppercase tracking-wider text-slate-400 md:grid ${clientView ? "grid-cols-[minmax(0,1fr)_170px_130px]" : "grid-cols-[minmax(0,1fr)_170px_130px_130px]"}`}>
                <span>Task</span>
                <span>Date</span>
                <span>Estimated</span>
                {!clientView && <span>Logged</span>}
              </div>
              <div className="divide-y divide-stone-100">
                {monthTickets.map((ticket) => (
                  <article
                    className={`grid gap-4 px-5 py-4 sm:px-7 md:items-center ${clientView ? "md:grid-cols-[minmax(0,1fr)_170px_130px]" : "md:grid-cols-[minmax(0,1fr)_170px_130px_130px]"}`}
                    key={ticket.id}
                  >
                    <Link
                      className="min-w-0 truncate font-medium text-slate-900 hover:text-pink-600"
                      href={`/projects/${projectId}/tickets/${ticket.id}`}
                    >
                      {ticket.title}
                    </Link>
                    <div>
                      <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-400 md:hidden">
                        Date
                      </p>
                      <time className="text-sm text-slate-600" dateTime={ticket.archivedAt}>
                        {formatDate(ticket.archivedAt)}
                      </time>
                    </div>
                    <div>
                      <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-400 md:hidden">
                        Estimated
                      </p>
                      <p className="text-sm font-medium text-slate-700">
                        {formatHours(ticket.estimatedHours)}h
                      </p>
                    </div>
                    {!clientView && <div>
                      <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-400 md:hidden">
                        Logged
                      </p>
                      <p className="text-sm font-medium text-slate-900">
                        {formatHours(ticket.loggedHours)}h
                      </p>
                    </div>}
                  </article>
                ))}
              </div>
            </section>
          ))}
        </div>
      ) : (
        <div className="rounded-2xl border border-dashed border-stone-300 bg-white/60 px-6 py-12 text-center">
          <Archive aria-hidden="true" className="mx-auto size-8 text-slate-300" />
          <p className="mt-3 font-medium text-slate-700">No archived tasks yet</p>
          <p className="mt-1 text-sm text-slate-500">
            {clientView
              ? "Delivered requests will appear here after they are archived."
              : "Archive a completed ticket to move it out of the delivery board."}
          </p>
        </div>
      )}
    </section>
  );
}
