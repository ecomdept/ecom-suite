"use client";

import { useCallback, useRef, useState } from "react";
import { Maximize2, Minimize2, Plus, X } from "lucide-react";
import { CreateTicketForm } from "@/components/projects/create-ticket-form";
import type { TicketMemberOption } from "@/components/projects/create-ticket-form";
import { Button } from "@/components/ui/button";

export function TicketComposer({ projectId, clientRequest = false, members = [] }: { projectId: string; clientRequest?: boolean; members?: TicketMemberOption[] }) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const [isOpen, setIsOpen] = useState(false);
  const [isFullScreen, setIsFullScreen] = useState(false);

  function openDialog() {
    setIsOpen(true);
    dialogRef.current?.showModal();
  }

  const closeDialog = useCallback(() => {
    dialogRef.current?.close();
    setIsOpen(false);
    setIsFullScreen(false);
  }, []);

  return (
    <>
      <Button className="h-10 bg-pink-600 hover:bg-pink-500" onClick={openDialog} type="button">
        <Plus aria-hidden="true" />{clientRequest ? "Request task" : "Create ticket"}
      </Button>

      <dialog
        aria-labelledby="create-ticket-title"
        className={`m-auto overflow-hidden border border-stone-200 bg-white p-0 text-slate-950 shadow-2xl backdrop:bg-slate-950/55 ${
          isFullScreen
            ? "h-svh max-h-none w-screen max-w-none rounded-none"
            : "max-h-[90svh] w-[calc(100%_-_2rem)] max-w-2xl rounded-2xl"
        }`}
        onClick={(event) => {
          if (event.target === event.currentTarget) closeDialog();
        }}
        onClose={() => {
          setIsOpen(false);
          setIsFullScreen(false);
        }}
        ref={dialogRef}
      >
        <div className="flex h-full max-h-[inherit] flex-col">
          <div className="flex items-center justify-between gap-4 border-b border-stone-100 px-5 py-4 sm:px-6">
            <div>
              <p className="text-xs font-semibold uppercase tracking-wider text-pink-600">{clientRequest ? "Client request" : "New work item"}</p>
              <h2 className="mt-1 text-xl font-semibold" id="create-ticket-title">{clientRequest ? "Request a new task" : "Create ticket"}</h2>
            </div>
            <div className="flex items-center gap-1">
              <Button
                aria-label={isFullScreen ? "Exit full screen" : "Open full screen"}
                onClick={() => setIsFullScreen((current) => !current)}
                size="icon"
                title={isFullScreen ? "Exit full screen" : "Open full screen"}
                type="button"
                variant="ghost"
              >
                {isFullScreen ? <Minimize2 aria-hidden="true" /> : <Maximize2 aria-hidden="true" />}
              </Button>
              <Button aria-label="Close ticket form" onClick={closeDialog} size="icon" title="Close" type="button" variant="ghost">
                <X aria-hidden="true" />
              </Button>
            </div>
          </div>
          <div className={`overflow-y-auto p-5 sm:p-6 ${isFullScreen ? "mx-auto w-full max-w-4xl flex-1 py-8 sm:py-12" : ""}`}>
            {isOpen && <CreateTicketForm clientRequest={clientRequest} members={members} onCreated={closeDialog} projectId={projectId} />}
          </div>
        </div>
      </dialog>
    </>
  );
}
