"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Archive, Loader2 } from "lucide-react";
import { moveTicketAction } from "@/app/projects/actions";
import { Button } from "@/components/ui/button";

export function ArchiveTicketButton({
  projectId,
  ticketId,
  ticketTitle,
}: {
  projectId: string;
  ticketId: string;
  ticketTitle: string;
}) {
  const router = useRouter();
  const [error, setError] = useState<string>();
  const [pending, startTransition] = useTransition();

  function archiveTicket() {
    if (!window.confirm(`Archive “${ticketTitle}”?`)) return;

    setError(undefined);
    startTransition(async () => {
      const formData = new FormData();
      formData.set("projectId", projectId);
      formData.set("ticketId", ticketId);
      formData.set("status", "archived");
      const result = await moveTicketAction(formData);

      if (result.error) {
        setError(result.error);
        return;
      }

      router.push(`/projects/${projectId}#archive-heading`);
      router.refresh();
    });
  }

  return (
    <div className="mt-4 border-t border-stone-100 pt-4">
      <Button
        className="w-full"
        disabled={pending}
        onClick={archiveTicket}
        type="button"
        variant="outline"
      >
        {pending ? <Loader2 className="animate-spin" /> : <Archive />}
        {pending ? "Archiving…" : "Archive ticket"}
      </Button>
      {error ? (
        <p className="mt-2 text-xs text-red-600" role="alert">
          {error}
        </p>
      ) : null}
    </div>
  );
}
