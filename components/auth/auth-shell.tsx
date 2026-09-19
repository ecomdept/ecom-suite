import { ArrowUpRight, CheckCircle2 } from "lucide-react";

export function AuthShell({ children }: { children: React.ReactNode }) {
  return (
    <main className="grid min-h-svh bg-[#f6f3ee] lg:grid-cols-[1.08fr_0.92fr]">
      <section className="relative hidden overflow-hidden bg-[#171717] p-12 text-white lg:flex lg:flex-col lg:justify-between xl:p-16">
        <div className="absolute inset-0 opacity-30 [background-image:linear-gradient(rgba(255,255,255,.08)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,.08)_1px,transparent_1px)] [background-size:80px_80px]" />
        <div className="absolute -bottom-40 -right-32 size-[34rem] rounded-full bg-[#f00073] opacity-25 blur-[140px]" />
        <div className="relative flex items-center gap-3">
          <span className="grid size-11 place-items-center bg-[#f00073] text-[11px] font-black tracking-tight">ED</span>
          <span><span className="block text-xs font-bold uppercase tracking-[0.18em]">Ecom Department</span><span className="mt-1 block text-[10px] uppercase tracking-[0.24em] text-white/45">Client workroom</span></span>
        </div>
        <div className="relative max-w-lg">
          <p className="mb-5 text-xs font-semibold uppercase tracking-[0.24em] text-[#ff64ad]">
            Design / Develop / Maintain / Market
          </p>
          <h1 className="font-display text-5xl leading-[0.98] xl:text-7xl">
            Great work starts with a clear conversation.
          </h1>
          <div className="mt-9 grid gap-4 text-sm text-white/60">
            {["Request and prioritize new work", "Follow delivery and retainer usage", "Keep every decision in one place"].map(
              (item) => (
                <div className="flex items-center gap-3" key={item}>
                  <CheckCircle2 aria-hidden="true" className="size-5 text-[#f00073]" />
                  {item}
                </div>
              ),
            )}
          </div>
        </div>
        <a className="relative inline-flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.16em] text-white/45 hover:text-white" href="https://www.ecomdepartment.com/" rel="noreferrer" target="_blank">ecomdepartment.com <ArrowUpRight aria-hidden="true" className="size-3.5" /></a>
      </section>

      <section className="flex min-h-svh items-center justify-center px-5 py-10 sm:px-8 lg:px-12">
        <div className="w-full max-w-md">
          <div className="mb-8 flex items-center gap-3 text-slate-950 lg:hidden">
            <span className="grid size-10 place-items-center bg-[#f00073] text-[10px] font-black text-white">ED</span>
            <span className="text-xs font-bold uppercase tracking-[0.16em]">Ecom Department</span>
          </div>
          {children}
        </div>
      </section>
    </main>
  );
}
