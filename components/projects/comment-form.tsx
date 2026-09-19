"use client";

import { useActionState, useEffect, useMemo, useRef, useState } from "react";
import { AtSign, Loader2, Send } from "lucide-react";
import { createCommentAction, type ProjectActionState } from "@/app/projects/actions";
import { FormMessage } from "@/components/auth/form-message";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import type { TicketMemberOption } from "@/components/projects/create-ticket-form";

const initialState: ProjectActionState = {};

export function CommentForm({ projectId, ticketId, members, canCreateInternalNote }: { projectId: string; ticketId: string; members: TicketMemberOption[]; canCreateInternalNote: boolean }) {
  const [state, formAction, pending] = useActionState(createCommentAction, initialState);
  const [content, setContent] = useState("");
  const [mentionQuery, setMentionQuery] = useState<string>();
  const [mentionStart, setMentionStart] = useState(-1);
  const [cursorPosition, setCursorPosition] = useState(0);
  const [activeIndex, setActiveIndex] = useState(0);
  const [mentionedMembers, setMentionedMembers] = useState<TicketMemberOption[]>([]);
  const [visibility, setVisibility] = useState<"public" | "internal">("public");
  const formRef = useRef<HTMLFormElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const suggestions = useMemo(() => mentionQuery === undefined ? [] : members.filter((member) => member.name.toLocaleLowerCase().includes(mentionQuery.toLocaleLowerCase())).slice(0, 6), [members, mentionQuery]);

  useEffect(() => {
    if (!state.success) return;
    formRef.current?.reset();
    setContent("");
    setMentionedMembers([]);
    setMentionQuery(undefined);
    setVisibility("public");
  }, [state.success]);

  function updateMentionState(value: string, cursor: number) {
    if (visibility === "internal") {
      setMentionQuery(undefined);
      return;
    }
    const beforeCursor = value.slice(0, cursor);
    const match = beforeCursor.match(/(?:^|\s)@([^@\n]*)$/u);
    if (!match) {
      setMentionQuery(undefined);
      return;
    }
    setMentionStart(beforeCursor.lastIndexOf("@"));
    setMentionQuery(match[1]);
    setCursorPosition(cursor);
    setActiveIndex(0);
  }

  function chooseMention(member: TicketMemberOption) {
    const nextContent = `${content.slice(0, mentionStart)}@${member.name} ${content.slice(cursorPosition)}`;
    const nextCursor = mentionStart + member.name.length + 2;
    setContent(nextContent);
    setMentionedMembers((current) => current.some((item) => item.id === member.id) ? current : [...current, member]);
    setMentionQuery(undefined);
    window.setTimeout(() => {
      textareaRef.current?.focus();
      textareaRef.current?.setSelectionRange(nextCursor, nextCursor);
    }, 0);
  }

  return (
    <form action={formAction} className="grid gap-3" ref={formRef}>
      <input name="projectId" type="hidden" value={projectId} /><input name="ticketId" type="hidden" value={ticketId} />
      <input name="commentVisibility" type="hidden" value={visibility} />
      {visibility === "public" && mentionedMembers.filter((member) => content.includes(`@${member.name}`)).map((member) => <input key={member.id} name="mentionedUserIds" type="hidden" value={member.id} />)}
      {canCreateInternalNote && <div aria-label="Comment visibility" className="flex w-fit rounded-lg bg-stone-200/70 p-1" role="group"><button aria-pressed={visibility === "public"} className={`rounded-md px-3 py-1.5 text-xs font-semibold transition ${visibility === "public" ? "bg-white text-slate-900 shadow-sm" : "text-slate-500 hover:text-slate-800"}`} onClick={() => { setVisibility("public"); setMentionQuery(undefined); }} type="button">Reply to client</button><button aria-pressed={visibility === "internal"} className={`rounded-md px-3 py-1.5 text-xs font-semibold transition ${visibility === "internal" ? "bg-amber-100 text-amber-900 shadow-sm" : "text-slate-500 hover:text-slate-800"}`} onClick={() => { setVisibility("internal"); setMentionQuery(undefined); setMentionedMembers([]); }} type="button">Internal note</button></div>}
      <div className="relative space-y-2">
        <div className="flex items-center justify-between gap-3"><Label htmlFor="comment-content">{visibility === "internal" ? "Add an internal note" : "Add a comment"}</Label>{visibility === "public" && <span className="flex items-center gap-1 text-xs text-slate-400"><AtSign aria-hidden="true" className="size-3" />Type @ to mention someone</span>}</div>
        <textarea
          aria-autocomplete="list"
          aria-controls="mention-suggestions"
          className="min-h-28 w-full resize-y rounded-lg border border-input bg-white px-3 py-2 text-sm shadow-sm outline-none placeholder:text-muted-foreground focus-visible:ring-1 focus-visible:ring-ring"
          id="comment-content"
          maxLength={2000}
          name="content"
          onChange={(event) => { const value = event.target.value; setContent(value); updateMentionState(value, event.target.selectionStart); }}
          onKeyDown={(event) => {
            if (!suggestions.length) return;
            if (event.key === "ArrowDown") { event.preventDefault(); setActiveIndex((current) => (current + 1) % suggestions.length); }
            if (event.key === "ArrowUp") { event.preventDefault(); setActiveIndex((current) => current <= 0 ? suggestions.length - 1 : current - 1); }
            if (event.key === "Enter" && mentionQuery !== undefined) { event.preventDefault(); chooseMention(suggestions[activeIndex]); }
            if (event.key === "Escape") setMentionQuery(undefined);
          }}
          placeholder={visibility === "internal" ? "Share context visible only to the agency team…" : "Share an update, ask a question, or type @ to notify a teammate…"}
          ref={textareaRef}
          required
          value={content}
        />
        {visibility === "public" && mentionQuery !== undefined && suggestions.length > 0 && <div className="absolute left-0 right-0 top-full z-20 mt-1 overflow-hidden rounded-xl border border-stone-200 bg-white p-1.5 shadow-xl" id="mention-suggestions" role="listbox">{suggestions.map((member, index) => <button aria-selected={index === activeIndex} className={`flex w-full items-center gap-3 rounded-lg px-3 py-2 text-left ${index === activeIndex ? "bg-pink-50" : "hover:bg-slate-50"}`} key={member.id} onClick={() => chooseMention(member)} role="option" type="button"><span className="grid size-8 place-items-center rounded-full bg-pink-100 text-xs font-semibold text-pink-700">{member.name.split(" ").slice(0, 2).map((part) => part[0]).join("").toUpperCase()}</span><span className="text-sm font-medium text-slate-900">{member.name}</span></button>)}</div>}
        {visibility === "internal" && <p className="text-xs text-amber-700">Only administrators and assigned agency team members can read this note.</p>}
      </div>
      <FormMessage error={state.error} success={state.success} />
      <Button className={`justify-self-start ${visibility === "internal" ? "bg-amber-700 hover:bg-amber-600" : "bg-pink-600 hover:bg-pink-500"}`} disabled={pending} type="submit">{pending ? <Loader2 aria-hidden="true" className="animate-spin" /> : <Send aria-hidden="true" />}{pending ? "Posting…" : visibility === "internal" ? "Post internal note" : "Post comment"}</Button>
    </form>
  );
}
