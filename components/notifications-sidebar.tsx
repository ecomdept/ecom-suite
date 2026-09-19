"use client";

import Link from "next/link";
import { useEffect, useState, useTransition } from "react";
import { Bell, Check, MessageSquareText, TicketCheck, X } from "lucide-react";
import { getNotificationsAction, markAllNotificationsReadAction, markNotificationReadAction, type NotificationItem } from "@/app/notifications/actions";
import { createClient } from "@/lib/supabase/client";

function formatNotificationDate(value: string) {
  return new Intl.DateTimeFormat("en", { dateStyle: "medium", timeStyle: "short" }).format(new Date(value));
}

export function NotificationsSidebar({ userId, initialNotifications }: { userId: string; initialNotifications: NotificationItem[] }) {
  const [open, setOpen] = useState(false);
  const [notifications, setNotifications] = useState(initialNotifications);
  const [isPending, startTransition] = useTransition();
  const [supabase] = useState(() => createClient());
  const unreadCount = notifications.filter((notification) => !notification.read_at).length;

  useEffect(() => {
    const channel = supabase
      .channel(`notifications:${userId}`)
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "notifications", filter: `recipient_id=eq.${userId}` }, (payload) => {
        const notification = payload.new as NotificationItem;
        setNotifications((current) => [notification, ...current.filter((item) => item.id !== notification.id)].slice(0, 30));
      })
      .subscribe();

    return () => { void supabase.removeChannel(channel); };
  }, [supabase, userId]);

  useEffect(() => {
    let active = true;
    async function refreshNotifications() {
      try {
        const latest = await getNotificationsAction();
        if (active) setNotifications(latest);
      } catch {
        // Realtime remains active; retry on the next interval or window focus.
      }
    }

    const interval = window.setInterval(refreshNotifications, 20_000);
    window.addEventListener("focus", refreshNotifications);
    return () => {
      active = false;
      window.clearInterval(interval);
      window.removeEventListener("focus", refreshNotifications);
    };
  }, []);

  function markRead(notificationId: string) {
    setNotifications((current) => current.map((notification) => notification.id === notificationId ? { ...notification, read_at: notification.read_at ?? new Date().toISOString() } : notification));
    startTransition(() => { void markNotificationReadAction(notificationId); });
  }

  function markAllRead() {
    const readAt = new Date().toISOString();
    setNotifications((current) => current.map((notification) => ({ ...notification, read_at: notification.read_at ?? readAt })));
    startTransition(() => { void markAllNotificationsReadAction(); });
  }

  return (
    <>
      <button aria-expanded={open} aria-label={unreadCount ? `Notifications, ${unreadCount} unread` : "Notifications"} className="relative grid size-9 shrink-0 place-items-center rounded-lg border border-white/15 bg-white/[0.07] text-white/70 transition hover:bg-white/15 hover:text-white" onClick={() => setOpen(true)} type="button"><Bell aria-hidden="true" className="size-4" />{unreadCount > 0 && <span className="absolute -right-1.5 -top-1.5 grid min-w-5 place-items-center rounded-full bg-[#f00073] px-1 text-[10px] font-bold leading-5 text-white ring-2 ring-[#171717]">{unreadCount > 99 ? "99+" : unreadCount}</span>}</button>
      {open && <div className="fixed inset-0 z-[70]" role="presentation"><button aria-label="Close notifications" className="absolute inset-0 bg-slate-950/40" onClick={() => setOpen(false)} type="button" /><aside aria-labelledby="notifications-heading" aria-modal="true" className="absolute bottom-0 right-0 top-0 flex w-full max-w-md flex-col bg-white shadow-2xl" role="dialog"><header className="flex items-center justify-between gap-3 border-b border-stone-200 px-5 py-5 sm:px-6"><div><h2 className="text-lg font-semibold" id="notifications-heading">Notifications</h2><p className="mt-0.5 text-xs text-slate-500">{unreadCount ? `${unreadCount} unread` : "You’re all caught up"}</p></div><div className="flex items-center gap-1">{unreadCount > 0 && <button className="inline-flex items-center gap-1.5 rounded-md px-2.5 py-2 text-xs font-medium text-pink-600 hover:bg-pink-50 disabled:opacity-50" disabled={isPending} onClick={markAllRead} type="button"><Check aria-hidden="true" className="size-3.5" />Mark all read</button>}<button aria-label="Close notifications" className="grid size-9 place-items-center rounded-md text-slate-500 hover:bg-stone-100" onClick={() => setOpen(false)} type="button"><X aria-hidden="true" className="size-5" /></button></div></header><div className="flex-1 overflow-y-auto">{notifications.length ? <div className="divide-y divide-slate-100">{notifications.map((notification) => { const Icon = notification.notification_type === "comment_mention" ? MessageSquareText : TicketCheck; return <Link className={`flex gap-3 px-5 py-5 transition hover:bg-slate-50 sm:px-6 ${notification.read_at ? "bg-white" : "bg-pink-50/60"}`} href={`/projects/${notification.project_id}/tickets/${notification.ticket_id}${notification.notification_type === "comment_mention" && notification.id ? "#comments-heading" : ""}`} key={notification.id} onClick={() => { markRead(notification.id); setOpen(false); }}><span className={`grid size-10 shrink-0 place-items-center rounded-xl ${notification.notification_type === "comment_mention" ? "bg-violet-100 text-violet-600" : "bg-pink-100 text-pink-600"}`}><Icon aria-hidden="true" className="size-5" /></span><span className="min-w-0 flex-1"><span className="block text-sm leading-5 text-slate-800">{notification.message}</span><time className="mt-1.5 block text-xs text-slate-400" dateTime={notification.created_at}>{formatNotificationDate(notification.created_at)}</time></span>{!notification.read_at && <span aria-label="Unread" className="mt-2 size-2 shrink-0 rounded-full bg-pink-500" />}</Link>; })}</div> : <div className="grid min-h-80 place-items-center px-8 text-center"><div><span className="mx-auto grid size-12 place-items-center rounded-2xl bg-stone-100 text-slate-400"><Bell aria-hidden="true" className="size-6" /></span><h3 className="mt-4 font-semibold">No notifications</h3><p className="mt-1 text-sm leading-5 text-slate-500">Assignments and comment mentions will appear here.</p></div></div>}</div></aside></div>}
    </>
  );
}
