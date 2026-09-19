import { Users } from "lucide-react";
import { requireUser } from "@/lib/auth/session";
import { isAppRole, ROLE_LABELS } from "@/lib/auth/roles";
import { createAdminClient } from "@/lib/supabase/admin";
import { DeleteUserButton } from "@/components/dashboard/delete-user-button";

function formatDate(value: string) {
  return new Intl.DateTimeFormat("en", {
    month: "short",
    day: "numeric",
    year: "numeric",
  }).format(new Date(value));
}

function getInitials(name: string) {
  return name
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join("");
}

export async function AdminUserList() {
  const { supabase, claims } = await requireUser();
  const currentUserId = typeof claims.sub === "string" ? claims.sub : "";
  const { data: currentRole } = await supabase
    .from("user_roles")
    .select("role")
    .eq("user_id", currentUserId)
    .maybeSingle();

  if (currentRole?.role !== "admin") return null;

  let adminClient;
  try {
    adminClient = createAdminClient();
  } catch {
    return (
      <p className="p-5 text-sm text-red-700 sm:p-7" role="alert">
        The server-side Supabase secret key is not configured, so users cannot be loaded.
      </p>
    );
  }

  const { data: authData, error: authError } = await adminClient.auth.admin.listUsers({
    page: 1,
    perPage: 1000,
  });

  if (authError) {
    return (
      <p className="p-5 text-sm text-red-700 sm:p-7" role="alert">
        Users could not be loaded. Check the server’s Supabase secret key.
      </p>
    );
  }

  const userIds = authData.users.map((user) => user.id);
  const [{ data: profiles }, { data: roleRows }] = userIds.length
    ? await Promise.all([
        adminClient.from("profiles").select("id, full_name").in("id", userIds),
        adminClient.from("user_roles").select("user_id, role").in("user_id", userIds),
      ])
    : [{ data: [] }, { data: [] }];
  const profileById = new Map(profiles?.map((profile) => [profile.id, profile]));
  const roleById = new Map(roleRows?.map((role) => [role.user_id, role.role]));

  return (
    <section
      aria-labelledby="users-heading"
      className="mt-10 overflow-hidden rounded-2xl border border-stone-200 bg-white shadow-sm"
    >
      <div className="flex items-center justify-between gap-4 border-b border-stone-100 px-5 py-5 sm:px-7">
        <div className="flex items-start gap-3">
          <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-pink-50 text-pink-600">
            <Users aria-hidden="true" className="size-5" />
          </span>
          <div>
            <h2 className="text-lg font-semibold" id="users-heading">
              Users
            </h2>
            <p className="mt-1 text-sm text-slate-500">
              Everyone with access to this workspace and their assigned role.
            </p>
          </div>
        </div>
        <span className="rounded-full bg-stone-100 px-2.5 py-1 text-xs font-semibold text-slate-600">
          {authData.users.length}
        </span>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full min-w-[860px] text-left text-sm">
          <caption className="sr-only">Workspace users and assigned roles</caption>
          <thead className="border-b border-stone-100 bg-slate-50/70 text-xs uppercase tracking-wider text-slate-500">
            <tr>
              <th className="px-5 py-3 font-semibold sm:px-7" scope="col">User</th>
              <th className="px-5 py-3 font-semibold" scope="col">Role</th>
              <th className="px-5 py-3 font-semibold" scope="col">Status</th>
              <th className="px-5 py-3 font-semibold sm:pr-7" scope="col">Added</th>
              <th className="px-5 py-3 text-right font-semibold sm:pr-7" scope="col">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {authData.users.map((user) => {
              const metadataName =
                typeof user.user_metadata?.full_name === "string"
                  ? user.user_metadata.full_name
                  : "";
              const name =
                profileById.get(user.id)?.full_name ||
                metadataName ||
                user.email?.split("@")[0] ||
                "Unknown user";
              const role = roleById.get(user.id);
              const roleLabel = role && isAppRole(role) ? ROLE_LABELS[role] : "Not assigned";
              const confirmed = Boolean(user.email_confirmed_at ?? user.confirmed_at);

              return (
                <tr className="scroll-mt-24 text-slate-700" id={`user-${user.id}`} key={user.id}>
                  <td className="px-5 py-4 sm:px-7">
                    <div className="flex items-center gap-3">
                      <span className="grid size-9 shrink-0 place-items-center rounded-full bg-pink-50 text-xs font-semibold text-pink-700">
                        {getInitials(name) || "?"}
                      </span>
                      <div className="min-w-0">
                        <p className="font-medium text-slate-950">{name}</p>
                        <p className="truncate text-xs text-slate-500">{user.email}</p>
                      </div>
                    </div>
                  </td>
                  <td className="px-5 py-4">
                    <span className="rounded-full bg-stone-100 px-2.5 py-1 text-xs font-medium text-slate-700">
                      {roleLabel}
                    </span>
                  </td>
                  <td className="px-5 py-4">
                    <span className={`inline-flex items-center gap-2 text-xs font-medium ${confirmed ? "text-emerald-700" : "text-amber-700"}`}>
                      <span className={`size-1.5 rounded-full ${confirmed ? "bg-emerald-500" : "bg-amber-500"}`} />
                      {confirmed ? "Confirmed" : "Invite pending"}
                    </span>
                  </td>
                  <td className="px-5 py-4 text-xs text-slate-500 sm:pr-7">
                    {formatDate(user.created_at)}
                  </td>
                  <td className="px-5 py-4 text-right sm:pr-7">
                    {user.id === currentUserId ? (
                      <span className="text-xs font-medium text-slate-400">You</span>
                    ) : (
                      <div className="flex justify-end"><DeleteUserButton userId={user.id} userName={name} /></div>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </section>
  );
}
