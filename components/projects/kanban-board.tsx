"use client";

import Link from "next/link";
import { useEffect, useState, useTransition } from "react";
import { Archive, ArrowLeft, ArrowRight, CircleDot, GripVertical, MessageSquare } from "lucide-react";
import { moveTicketAction } from "@/app/projects/actions";
import { Button } from "@/components/ui/button";
import { markdownToPlainText } from "@/components/ui/markdown-content";
import type { TicketPriority, TicketStatus, TicketType } from "@/lib/projects/validation";

type Ticket = {
  id: string;
  title: string;
  description: string | null;
  status: TicketStatus;
  priority: TicketPriority;
  ticket_type: TicketType;
  estimated_hours: number;
  logged_hours: number;
  created_at: string;
};

const columns: Array<{ status: TicketStatus; label: string; dot: string }> = [
  { status: "backlog", label: "Backlog", dot: "bg-slate-400" },
  { status: "pending_approval", label: "Pending approval", dot: "bg-amber-500" },
  { status: "in_progress", label: "In progress", dot: "bg-blue-500" },
  { status: "client_uat", label: "Client UAT", dot: "bg-fuchsia-500" },
  { status: "ready_for_deploy", label: "Ready for deploy", dot: "bg-cyan-500" },
  { status: "completed", label: "Completed", dot: "bg-emerald-500" },
];

const priorityClasses: Record<TicketPriority, string> = {
  low: "bg-stone-100 text-slate-600",
  medium: "bg-amber-50 text-amber-700",
  high: "bg-red-50 text-red-700",
};

const typeLabels: Record<TicketType, string> = {
  new_feature: "New feature",
  feature_update: "Feature update",
  bug: "Bug",
};

export function KanbanBoard({ projectId, tickets: initialTickets, canManage, clientView = false }: { projectId: string; tickets: Ticket[]; canManage: boolean; clientView?: boolean }) {
  const [tickets, setTickets] = useState(initialTickets);
  const [draggedTicketId, setDraggedTicketId] = useState<string>();
  const [dropTarget, setDropTarget] = useState<TicketStatus>();
  const [moveError, setMoveError] = useState<string>();
  const [isMoving, startTransition] = useTransition();
  const visibleColumns = clientView
    ? columns.map((column) => ({ ...column, label: column.status === "backlog" ? "Submitted" : column.status === "in_progress" ? "In delivery" : column.status === "client_uat" ? "Ready for review" : column.status === "ready_for_deploy" ? "Ready to deploy" : column.status === "completed" ? "Delivered" : column.label }))
    : columns;

  useEffect(() => setTickets(initialTickets), [initialTickets]);

  function moveTicket(ticketId: string, status: TicketStatus) {
    const previousTickets = tickets;
    const ticket = tickets.find((item) => item.id === ticketId);
    if (!ticket || ticket.status === status || !canManage) return;

    setMoveError(undefined);
    setTickets((current) => current.map((item) => item.id === ticketId ? { ...item, status } : item));
    startTransition(async () => {
      try {
        const formData = new FormData();
        formData.set("projectId", projectId);
        formData.set("ticketId", ticketId);
        formData.set("status", status);
        const result = await moveTicketAction(formData);

        if (!result.error) return;
        setTickets(previousTickets);
        setMoveError(result.error);
      } catch {
        setTickets(previousTickets);
        setMoveError("The ticket could not be moved. Please try again.");
      }
    });
  }

  return (
    <section aria-label="Project ticket board">
      {canManage && (
        <p className="mb-3 text-xs text-slate-500">
          Drag tickets between columns, or use each card’s arrow buttons with a keyboard or touch screen.
        </p>
      )}
      {moveError && <p className="mb-3 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700" role="alert">{moveError}</p>}
      <div className="grid items-start gap-5 md:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-6">
        {visibleColumns.map((column, columnIndex) => {
          const columnTickets = tickets.filter((ticket) => ticket.status === column.status);
          const isActiveTarget = dropTarget === column.status;

          return (
            <div
              className={`min-h-48 rounded-2xl border p-3 transition ${isActiveTarget ? "border-pink-400 bg-pink-50 ring-2 ring-pink-200" : "border-stone-200 bg-[#ebe7e0]/70"}`}
              key={column.status}
              onDragEnter={(event) => {
                if (!canManage) return;
                event.preventDefault();
                setDropTarget(column.status);
              }}
              onDragOver={(event) => {
                if (!canManage) return;
                event.preventDefault();
                event.dataTransfer.dropEffect = "move";
              }}
              onDrop={(event) => {
                event.preventDefault();
                const ticketId = event.dataTransfer.getData("text/plain") || draggedTicketId;
                if (ticketId) moveTicket(ticketId, column.status);
                setDraggedTicketId(undefined);
                setDropTarget(undefined);
              }}
            >
              <div className="flex items-center justify-between px-1 pb-3 pt-1">
                <h2 className="flex items-center gap-2 text-sm font-semibold text-slate-800">
                  <span className={`size-2 rounded-full ${column.dot}`} />{column.label}
                </h2>
                <span className="rounded-full bg-white px-2 py-0.5 text-xs font-semibold text-slate-500">{columnTickets.length}</span>
              </div>
              <div className="grid gap-3">
                {columnTickets.map((ticket) => (
                  <article
                    className={`rounded-xl border border-stone-200 bg-white p-4 shadow-[0_1px_2px_rgba(23,23,23,.04)] transition hover:-translate-y-0.5 hover:border-stone-300 hover:shadow-md ${canManage ? "cursor-grab active:cursor-grabbing" : ""} ${draggedTicketId === ticket.id ? "opacity-40" : ""}`}
                    draggable={canManage && !isMoving}
                    key={ticket.id}
                    onDragEnd={() => {
                      setDraggedTicketId(undefined);
                      setDropTarget(undefined);
                    }}
                    onDragStart={(event) => {
                      if (!canManage) return;
                      setDraggedTicketId(ticket.id);
                      event.dataTransfer.effectAllowed = "move";
                      event.dataTransfer.setData("text/plain", ticket.id);
                    }}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex min-w-0 items-start gap-1">
                        {canManage && <GripVertical aria-hidden="true" className="mt-0.5 size-4 shrink-0 text-slate-300" />}
                        <h3 className="font-medium leading-5 text-slate-950">{ticket.title}</h3>
                      </div>
                      <span className={`shrink-0 rounded-full px-2 py-1 text-[10px] font-semibold uppercase tracking-wide ${priorityClasses[ticket.priority]}`}>{ticket.priority}</span>
                    </div>
                    {ticket.description && <p className="mt-2 line-clamp-3 text-sm leading-5 text-slate-600">{markdownToPlainText(ticket.description)}</p>}
                    {!clientView && (Number(ticket.estimated_hours) > 0 || Number(ticket.logged_hours) > 0) && (
                      <div className="mt-3 flex gap-3 text-[11px] text-slate-500">
                        {Number(ticket.estimated_hours) > 0 && <span>{Number(ticket.estimated_hours).toFixed(1)}h estimated</span>}
                        {Number(ticket.logged_hours) > 0 && <span>{Number(ticket.logged_hours).toFixed(1)}h logged</span>}
                      </div>
                    )}
                    <Link className="mt-3 inline-flex items-center gap-1.5 text-xs font-medium text-pink-600 hover:text-pink-500" draggable={false} href={`/projects/${projectId}/tickets/${ticket.id}`}>
                      <MessageSquare aria-hidden="true" className="size-3.5" />View ticket and comments
                    </Link>
                    <div className="mt-4 flex items-center justify-between gap-3 border-t border-stone-100 pt-3">
                      <span className="flex items-center gap-1.5 text-xs text-slate-400"><CircleDot aria-hidden="true" className="size-3" />{typeLabels[ticket.ticket_type]}</span>
                      {canManage && (
                        <div className="flex gap-1">
                          {columnIndex > 0 && <Button aria-label={`Move ${ticket.title} left`} disabled={isMoving} onClick={() => moveTicket(ticket.id, visibleColumns[columnIndex - 1].status)} size="icon" type="button" variant="ghost"><ArrowLeft aria-hidden="true" /></Button>}
                          {columnIndex < visibleColumns.length - 1 && <Button aria-label={`Move ${ticket.title} right`} disabled={isMoving} onClick={() => moveTicket(ticket.id, visibleColumns[columnIndex + 1].status)} size="icon" type="button" variant="ghost"><ArrowRight aria-hidden="true" /></Button>}
                          {column.status === "completed" && <Button aria-label={`Archive ${ticket.title}`} disabled={isMoving} onClick={() => moveTicket(ticket.id, "archived")} size="icon" title="Archive ticket" type="button" variant="ghost"><Archive aria-hidden="true" /></Button>}
                        </div>
                      )}
                    </div>
                  </article>
                ))}
                {columnTickets.length === 0 && <div className="rounded-xl border border-dashed border-slate-300 px-4 py-8 text-center text-sm text-slate-400">{clientView ? "No requests here yet" : "Drop tickets here"}</div>}
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}
