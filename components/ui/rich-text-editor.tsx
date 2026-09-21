"use client";

import { useRef, useState } from "react";
import { Bold, Code2, Eye, Heading2, Italic, Link2, List, ListOrdered, PencilLine, Quote } from "lucide-react";
import { MarkdownContent } from "@/components/ui/markdown-content";

type RichTextEditorProps = {
  id: string;
  name: string;
  defaultValue?: string;
  placeholder?: string;
  maxLength?: number;
  required?: boolean;
  minHeight?: string;
  ariaDescribedBy?: string;
};

export function RichTextEditor({ id, name, defaultValue = "", placeholder, maxLength = 5000, required = false, minHeight = "min-h-32", ariaDescribedBy }: RichTextEditorProps) {
  const [value, setValue] = useState(defaultValue);
  const [mode, setMode] = useState<"write" | "preview">("write");
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  function replaceSelection(before: string, after = before, fallback = "text") {
    const textarea = textareaRef.current;
    if (!textarea) return;
    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    const selected = value.slice(start, end) || fallback;
    const next = `${value.slice(0, start)}${before}${selected}${after}${value.slice(end)}`;
    if (next.length > maxLength) return;
    setValue(next);
    window.setTimeout(() => {
      textarea.focus();
      textarea.setSelectionRange(start + before.length, start + before.length + selected.length);
    }, 0);
  }

  function prefixLines(prefix: string) {
    const textarea = textareaRef.current;
    if (!textarea) return;
    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    const selected = value.slice(start, end) || "List item";
    const replacement = selected.split("\n").map((line, index) => prefix === "1. " ? `${index + 1}. ${line}` : `${prefix}${line}`).join("\n");
    const next = `${value.slice(0, start)}${replacement}${value.slice(end)}`;
    if (next.length > maxLength) return;
    setValue(next);
    window.setTimeout(() => textarea.focus(), 0);
  }

  const tools = [
    { label: "Bold", icon: Bold, action: () => replaceSelection("**") },
    { label: "Italic", icon: Italic, action: () => replaceSelection("_") },
    { label: "Heading", icon: Heading2, action: () => prefixLines("## ") },
    { label: "Bulleted list", icon: List, action: () => prefixLines("- ") },
    { label: "Numbered list", icon: ListOrdered, action: () => prefixLines("1. ") },
    { label: "Quote", icon: Quote, action: () => prefixLines("> ") },
    { label: "Inline code", icon: Code2, action: () => replaceSelection("`") },
    { label: "Link", icon: Link2, action: () => replaceSelection("[", "](https://)", "link text") },
  ];

  return (
    <div className="overflow-hidden rounded-xl border border-input bg-white shadow-sm focus-within:border-pink-300 focus-within:ring-2 focus-within:ring-pink-100">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-stone-200 bg-stone-50/80 px-2 py-1.5">
        <div aria-label="Text formatting" className="flex flex-wrap items-center gap-0.5" role="toolbar">
          {tools.map((tool) => <button aria-label={tool.label} className="grid size-8 place-items-center rounded-md text-slate-500 transition hover:bg-white hover:text-slate-900 hover:shadow-sm" key={tool.label} onClick={tool.action} title={tool.label} type="button"><tool.icon aria-hidden="true" className="size-4" /></button>)}
        </div>
        <div className="flex rounded-md bg-stone-200/70 p-0.5"><button aria-pressed={mode === "write"} className={`flex items-center gap-1 rounded px-2 py-1 text-[11px] font-medium ${mode === "write" ? "bg-white text-slate-900 shadow-sm" : "text-slate-500"}`} onClick={() => setMode("write")} type="button"><PencilLine aria-hidden="true" className="size-3" />Write</button><button aria-pressed={mode === "preview"} className={`flex items-center gap-1 rounded px-2 py-1 text-[11px] font-medium ${mode === "preview" ? "bg-white text-slate-900 shadow-sm" : "text-slate-500"}`} onClick={() => setMode("preview")} type="button"><Eye aria-hidden="true" className="size-3" />Preview</button></div>
      </div>
      <textarea
        aria-describedby={ariaDescribedBy}
        className={`${minHeight} w-full resize-y bg-transparent px-3.5 py-3 text-sm leading-6 outline-none placeholder:text-slate-400 ${mode === "preview" ? "hidden" : "block"}`}
        id={id}
        maxLength={maxLength}
        name={name}
        onChange={(event) => setValue(event.target.value)}
        onKeyDown={(event) => {
          if (!(event.metaKey || event.ctrlKey)) return;
          if (event.key.toLowerCase() === "b") { event.preventDefault(); replaceSelection("**"); }
          if (event.key.toLowerCase() === "i") { event.preventDefault(); replaceSelection("_"); }
          if (event.key.toLowerCase() === "k") { event.preventDefault(); replaceSelection("[", "](https://)", "link text"); }
        }}
        placeholder={placeholder}
        ref={textareaRef}
        required={required}
        value={value}
      />
      {mode === "preview" && <div className={`${minHeight} px-4 py-3`}>{value.trim() ? <MarkdownContent content={value} /> : <p className="text-sm text-slate-400">Nothing to preview yet.</p>}</div>}
      <div className="flex items-center justify-between border-t border-stone-100 px-3 py-1.5 text-[10px] text-slate-400"><span>Markdown supported · ⌘/Ctrl+B, I, K</span><span>{value.length.toLocaleString()} / {maxLength.toLocaleString()}</span></div>
    </div>
  );
}
