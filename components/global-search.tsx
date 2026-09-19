"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import { Bug, FolderKanban, Loader2, Search, UserRound, Workflow, X } from "lucide-react";
import { globalSearchAction, type GlobalSearchResult } from "@/app/search/actions";

const resultDetails = {
  project: { label: "Projects", icon: FolderKanban, classes: "bg-pink-50 text-pink-600" },
  ticket: { label: "Tickets", icon: Bug, classes: "bg-blue-50 text-blue-600" },
  subtask: { label: "Subtasks", icon: Workflow, classes: "bg-violet-50 text-violet-600" },
  user: { label: "People", icon: UserRound, classes: "bg-emerald-50 text-emerald-600" },
};

export function GlobalSearch() {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<GlobalSearchResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [open, setOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(-1);
  const containerRef = useRef<HTMLDivElement>(null);
  const requestIdRef = useRef(0);

  useEffect(() => {
    const term = query.trim();
    const requestId = ++requestIdRef.current;
    if (term.length < 2) {
      setResults([]);
      setLoading(false);
      setActiveIndex(-1);
      return;
    }

    setLoading(true);
    const timeout = window.setTimeout(async () => {
      try {
        const response = await globalSearchAction(term);
        if (requestId !== requestIdRef.current) return;
        setResults(response.results);
        setOpen(true);
        setActiveIndex(-1);
      } catch {
        if (requestId === requestIdRef.current) setResults([]);
      } finally {
        if (requestId === requestIdRef.current) setLoading(false);
      }
    }, 250);

    return () => window.clearTimeout(timeout);
  }, [query]);

  useEffect(() => {
    function closeOnOutsideClick(event: MouseEvent) {
      if (!containerRef.current?.contains(event.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", closeOnOutsideClick);
    return () => document.removeEventListener("mousedown", closeOnOutsideClick);
  }, []);

  const groupedResults = useMemo(() => Object.entries(resultDetails).map(([type, details]) => ({
    type: type as GlobalSearchResult["type"],
    ...details,
    results: results.filter((result) => result.type === type),
  })).filter((group) => group.results.length), [results]);

  function handleKeyDown(event: React.KeyboardEvent<HTMLInputElement>) {
    if (event.key === "Escape") {
      setOpen(false);
      return;
    }
    if (!results.length || (event.key !== "ArrowDown" && event.key !== "ArrowUp" && event.key !== "Enter")) return;
    event.preventDefault();
    if (event.key === "ArrowDown") setActiveIndex((current) => (current + 1) % results.length);
    if (event.key === "ArrowUp") setActiveIndex((current) => current <= 0 ? results.length - 1 : current - 1);
    if (event.key === "Enter" && activeIndex >= 0) {
      const result = results[activeIndex];
      if (result.href) window.location.assign(result.href);
    }
  }

  return (
    <div className="relative order-3 w-full lg:order-none lg:max-w-xl lg:flex-1" ref={containerRef}>
      <div className="relative"><Search aria-hidden="true" className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-white/35" /><input aria-autocomplete="list" aria-controls="global-search-results" aria-expanded={open} aria-label="Search projects, tickets, subtasks, and users" autoComplete="off" className="h-10 w-full rounded-xl border border-white/10 bg-white/[0.07] pl-9 pr-10 text-sm text-white outline-none transition placeholder:text-white/35 focus:border-pink-500/70 focus:bg-white/10 focus:ring-2 focus:ring-pink-500/20" onChange={(event) => { setQuery(event.target.value); setOpen(true); }} onFocus={() => query.trim().length >= 2 && setOpen(true)} onKeyDown={handleKeyDown} placeholder="Search your workroom…" role="combobox" type="search" value={query} />{loading ? <Loader2 aria-hidden="true" className="absolute right-3 top-1/2 size-4 -translate-y-1/2 animate-spin text-pink-400" /> : query && <button aria-label="Clear search" className="absolute right-2 top-1/2 grid size-7 -translate-y-1/2 place-items-center rounded-md text-white/40 hover:bg-white/10 hover:text-white" onClick={() => { setQuery(""); setOpen(false); }} type="button"><X aria-hidden="true" className="size-4" /></button>}</div>

      {open && query.trim().length >= 2 && <div className="absolute left-0 right-0 z-50 mt-2 max-h-[min(70svh,32rem)] overflow-y-auto rounded-2xl border border-stone-200 bg-white p-2 shadow-2xl" id="global-search-results" role="listbox">
        {!loading && !results.length && <div className="px-4 py-8 text-center"><Search aria-hidden="true" className="mx-auto size-6 text-slate-300" /><p className="mt-2 text-sm font-medium text-slate-700">No results found</p><p className="mt-1 text-xs text-slate-400">Try a project, ticket, subtask, or person’s name.</p></div>}
        {groupedResults.map((group) => <section aria-label={group.label} key={group.type}><h2 className="px-3 pb-1 pt-3 text-[10px] font-semibold uppercase tracking-[0.14em] text-slate-400">{group.label}</h2><div className="grid gap-0.5">{group.results.map((result) => {
          const index = results.findIndex((candidate) => candidate.type === result.type && candidate.id === result.id);
          const content = <><span className={`grid size-8 shrink-0 place-items-center rounded-lg ${group.classes}`}><group.icon aria-hidden="true" className="size-4" /></span><span className="min-w-0 flex-1"><span className="block truncate text-sm font-medium text-slate-900">{result.title}</span><span className="block truncate text-xs capitalize text-slate-500">{result.detail}</span></span></>;
          const classes = `flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left ${activeIndex === index ? "bg-pink-50" : "hover:bg-slate-50"}`;
          return result.href ? <Link aria-selected={activeIndex === index} className={classes} href={result.href} key={`${result.type}-${result.id}`} onClick={() => setOpen(false)} role="option">{content}</Link> : <div aria-selected={activeIndex === index} className={classes} key={`${result.type}-${result.id}`} role="option">{content}</div>;
        })}</div></section>)}
      </div>}
    </div>
  );
}
