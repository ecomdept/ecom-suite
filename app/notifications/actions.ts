"use server";

import { revalidatePath } from "next/cache";
import { requireUser } from "@/lib/auth/session";
import { isUuid } from "@/lib/projects/validation";

export type NotificationItem = {
  id: string;
  notification_type: "ticket_assignment" | "comment_mention";
  project_id: string;
  ticket_id: string;
  message: string;
  read_at: string | null;
  created_at: string;
};

export async function getNotificationsAction(): Promise<NotificationItem[]> {
  const { supabase } = await requireUser();
  const { data, error } = await supabase
    .from("notifications")
    .select("id, notification_type, project_id, ticket_id, message, read_at, created_at")
    .order("created_at", { ascending: false })
    .limit(30);
  if (error) console.error("notification refresh failed", { code: error.code, message: error.message });

  return (data ?? []).filter(
    (notification) => notification.notification_type === "ticket_assignment" || notification.notification_type === "comment_mention",
  ) as NotificationItem[];
}

export async function markNotificationReadAction(notificationId: string) {
  if (!isUuid(notificationId)) return;
  const { supabase } = await requireUser();
  await supabase.from("notifications").update({ read_at: new Date().toISOString() }).eq("id", notificationId);
  revalidatePath("/", "layout");
}

export async function markAllNotificationsReadAction() {
  const { supabase } = await requireUser();
  await supabase.from("notifications").update({ read_at: new Date().toISOString() }).is("read_at", null);
  revalidatePath("/", "layout");
}
