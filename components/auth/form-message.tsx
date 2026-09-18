import { CircleCheck, CircleX } from "lucide-react";

export function FormMessage({ error, success }: { error?: string; success?: string }) {
  const message = error ?? success;
  if (!message) return null;

  return (
    <div
      aria-live="polite"
      className={`flex items-start gap-2 rounded-lg border px-3 py-2.5 text-sm ${
        error
          ? "border-red-200 bg-red-50 text-red-700"
          : "border-emerald-200 bg-emerald-50 text-emerald-700"
      }`}
      role={error ? "alert" : "status"}
    >
      {error ? (
        <CircleX aria-hidden="true" className="mt-0.5 size-4 shrink-0" />
      ) : (
        <CircleCheck aria-hidden="true" className="mt-0.5 size-4 shrink-0" />
      )}
      <span>{message}</span>
    </div>
  );
}
