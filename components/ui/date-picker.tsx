import { CalendarDays } from "lucide-react";
import { cn } from "@/lib/utils";
import { Input } from "@/components/ui/input";

type DatePickerProps = Omit<React.ComponentProps<typeof Input>, "type">;

export function DatePicker({ className, ...props }: DatePickerProps) {
  return (
    <div className="relative">
      <CalendarDays aria-hidden="true" className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-slate-400" />
      <Input className={cn("pl-9", className)} type="date" {...props} />
    </div>
  );
}
