import { CheckCircle2, Layers3 } from "lucide-react";

export function AuthShell({ children }: { children: React.ReactNode }) {
  return (
    <main className="grid min-h-svh bg-slate-50 lg:grid-cols-[1.05fr_0.95fr]">
      <section className="relative hidden overflow-hidden bg-slate-950 p-12 text-white lg:flex lg:flex-col lg:justify-between">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_20%_15%,rgba(99,102,241,0.35),transparent_30%),radial-gradient(circle_at_80%_80%,rgba(14,165,233,0.22),transparent_34%)]" />
        <div className="relative flex items-center gap-3 text-lg font-semibold">
          <span className="grid size-10 place-items-center rounded-xl bg-indigo-500 shadow-lg shadow-indigo-950/40">
            <Layers3 aria-hidden="true" className="size-5" />
          </span>
          Orbit
        </div>
        <div className="relative max-w-lg">
          <p className="mb-4 text-sm font-semibold uppercase tracking-[0.2em] text-indigo-300">
            Work, in focus
          </p>
          <h1 className="text-4xl font-semibold leading-tight tracking-tight xl:text-5xl">
            A calmer place for your team to plan and deliver.
          </h1>
          <div className="mt-8 grid gap-4 text-sm text-slate-300">
            {["Keep every priority visible", "Bring decisions and work together", "Move projects forward with clarity"].map(
              (item) => (
                <div className="flex items-center gap-3" key={item}>
                  <CheckCircle2 aria-hidden="true" className="size-5 text-indigo-400" />
                  {item}
                </div>
              ),
            )}
          </div>
        </div>
        <p className="relative text-xs text-slate-500">Simple project coordination for focused teams.</p>
      </section>

      <section className="flex min-h-svh items-center justify-center px-5 py-10 sm:px-8 lg:px-12">
        <div className="w-full max-w-md">
          <div className="mb-8 flex items-center gap-3 text-lg font-semibold text-slate-950 lg:hidden">
            <span className="grid size-10 place-items-center rounded-xl bg-indigo-600 text-white">
              <Layers3 aria-hidden="true" className="size-5" />
            </span>
            Orbit
          </div>
          {children}
        </div>
      </section>
    </main>
  );
}
