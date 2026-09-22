"use client";

import { useCallback, useRef, useState } from "react";
import { FolderPlus, X } from "lucide-react";
import { CreateProjectForm, type ProjectMemberOption } from "@/components/projects/create-project-form";
import { Button } from "@/components/ui/button";

export function ProjectComposer({ users }: { users: ProjectMemberOption[] }) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const [isOpen, setIsOpen] = useState(false);

  function openDialog() {
    setIsOpen(true);
    dialogRef.current?.showModal();
  }

  const closeDialog = useCallback(() => {
    dialogRef.current?.close();
    setIsOpen(false);
  }, []);

  return (
    <>
      <Button className="h-11 bg-pink-600 px-5 hover:bg-pink-500" onClick={openDialog} type="button">
        <FolderPlus aria-hidden="true" />Create project
      </Button>
      <dialog
        aria-labelledby="create-project-title"
        className="m-auto max-h-[92svh] w-[calc(100%_-_2rem)] max-w-3xl overflow-hidden rounded-2xl border border-stone-200 bg-white p-0 text-slate-950 shadow-2xl backdrop:bg-slate-950/55"
        onClick={(event) => {
          if (event.target === event.currentTarget) closeDialog();
        }}
        onClose={() => setIsOpen(false)}
        ref={dialogRef}
      >
        <div className="flex max-h-[92svh] flex-col">
          <div className="flex items-center justify-between border-b border-stone-100 px-5 py-4 sm:px-7">
            <div><p className="eyebrow">Portfolio setup</p><h2 className="mt-1 text-xl font-semibold" id="create-project-title">Create a project</h2></div>
            <Button aria-label="Close project form" onClick={closeDialog} size="icon" type="button" variant="ghost"><X aria-hidden="true" /></Button>
          </div>
          <div className="overflow-y-auto p-5 sm:p-7">{isOpen && <CreateProjectForm users={users} />}</div>
        </div>
      </dialog>
    </>
  );
}
