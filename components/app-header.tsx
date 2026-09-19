import Link from "next/link";
import { ListChecks } from "lucide-react";
import { LogoutButton } from "@/components/logout-button";
import { GlobalSearch } from "@/components/global-search";
import { NotificationsSidebar } from "@/components/notifications-sidebar";
import { requireUser } from "@/lib/auth/session";
import type { NotificationItem } from "@/app/notifications/actions";

export async function AppHeader() {
  const { supabase, claims } = await requireUser();
  const userId = typeof claims.sub === "string" ? claims.sub : "";
  const [{ data: notificationRows }, { data: roleRecord }] = await Promise.all([
    supabase
      .from("notifications")
      .select("id, notification_type, project_id, ticket_id, message, read_at, created_at")
      .order("created_at", { ascending: false })
      .limit(30),
    supabase.from("user_roles").select("role").eq("user_id", userId).maybeSingle(),
  ]);
  const isClient = roleRecord?.role === "client";
  const notifications = (notificationRows ?? []).filter(
    (notification) => notification.notification_type === "ticket_assignment" || notification.notification_type === "comment_mention",
  ) as NotificationItem[];

  return (
    <header className="sticky top-0 z-50 border-b border-white/10 bg-[#171717] text-white shadow-[0_8px_30px_rgba(0,0,0,0.12)]">
      <div className="mx-auto flex min-h-[4.5rem] max-w-[1500px] flex-wrap items-center justify-between gap-3 px-5 py-3 sm:px-8 lg:flex-nowrap">
        <div className="flex items-center gap-3 sm:gap-6">
          <Link className="flex items-center gap-3" href="/dashboard">
            <span className="grid size-9 place-items-center bg-[#f00073] text-[10px] font-black tracking-tight text-white">
              ED
            </span>
            <span className="hidden leading-none sm:block"><span className="block text-[11px] font-bold uppercase tracking-[0.16em]">Ecom</span><span className="mt-1 block text-[9px] uppercase tracking-[0.22em] text-white/50">Workroom</span></span>
          </Link>
          <nav aria-label="Primary navigation" className="flex items-center gap-1 text-sm">
            <Link className="hidden rounded-lg px-3 py-2 text-white/60 transition hover:bg-white/10 hover:text-white sm:block" href="/dashboard">Dashboard</Link>
            <Link className="rounded-lg px-2 py-2 text-white/60 transition hover:bg-white/10 hover:text-white sm:px-3" href="/projects">Projects</Link>
            {!isClient && <Link className="flex items-center gap-1.5 rounded-lg px-2 py-2 text-white/60 transition hover:bg-white/10 hover:text-white sm:px-3" href="/my-tasks"><ListChecks aria-hidden="true" className="hidden size-4 sm:block" />My tasks</Link>}
          </nav>
        </div>
        {!isClient && <GlobalSearch />}
        <div className="flex items-center gap-2"><NotificationsSidebar initialNotifications={notifications} userId={userId} /><LogoutButton /></div>
      </div>
    </header>
  );
}
