"use server";

import { headers } from "next/headers";
import { revalidatePath } from "next/cache";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireUser } from "@/lib/auth/session";
import { isAppRole } from "@/lib/auth/roles";
import { validateEmail, validateFullName } from "@/lib/auth/validation";
import { isUuid } from "@/lib/projects/validation";

export type InviteActionState = {
  error?: string;
  success?: string;
};

export type DeleteUserActionState = {
  error?: string;
};

function getString(formData: FormData, key: string) {
  const value = formData.get(key);
  return typeof value === "string" ? value : "";
}

async function getOrigin() {
  const requestHeaders = await headers();
  const host = requestHeaders.get("x-forwarded-host") ?? requestHeaders.get("host");
  const protocol = requestHeaders.get("x-forwarded-proto") ?? "http";

  return host ? `${protocol}://${host}` : "http://localhost:3000";
}

export async function inviteUserAction(
  previousState: InviteActionState,
  formData: FormData,
): Promise<InviteActionState> {
  void previousState;
  const fullName = getString(formData, "fullName").trim();
  const email = getString(formData, "email").trim().toLowerCase();
  const role = getString(formData, "role");
  const validationError = validateFullName(fullName) ?? validateEmail(email);

  if (validationError) return { error: validationError };
  if (!isAppRole(role)) return { error: "Select a valid account role." };

  const { supabase, claims } = await requireUser();
  const currentUserId = typeof claims.sub === "string" ? claims.sub : "";
  const { data: currentRole } = await supabase
    .from("user_roles")
    .select("role")
    .eq("user_id", currentUserId)
    .maybeSingle();

  if (currentRole?.role !== "admin") {
    return { error: "Only administrators can invite users." };
  }

  let adminClient;
  try {
    adminClient = createAdminClient();
  } catch {
    return { error: "Invitations are not configured on this server yet." };
  }

  const origin = await getOrigin();
  const { data: invitation, error: inviteError } =
    await adminClient.auth.admin.inviteUserByEmail(email, {
      data: { full_name: fullName },
      redirectTo: `${origin}/auth/confirm?next=/auth/set-password`,
    });

  if (inviteError || !invitation.user) {
    const message = inviteError?.message ?? "No user was returned by Supabase.";
    const normalizedMessage = message.toLowerCase();
    const alreadyRegistered =
      inviteError?.code === "email_exists" ||
      inviteError?.code === "user_already_exists" ||
      normalizedMessage.includes("already") ||
      normalizedMessage.includes("registered") ||
      normalizedMessage.includes("exists");
    const rateLimited =
      inviteError?.status === 429 || normalizedMessage.includes("rate limit");

    console.error("Supabase invitation failed", {
      code: inviteError?.code,
      status: inviteError?.status,
      message,
    });

    return {
      error: alreadyRegistered
        ? "An account already exists for this email address. Ask the user to use Forgot password to finish setting up access."
        : rateLimited
          ? "Too many invitation emails were requested. Wait a few minutes and try again."
          : `Supabase could not send the invitation: ${message}`,
    };
  }

  const { error: roleError } = await adminClient.from("user_roles").upsert(
    {
      user_id: invitation.user.id,
      role,
      assigned_by: currentUserId,
    },
    { onConflict: "user_id" },
  );

  if (roleError) {
    return {
      error:
        "The invitation was sent, but the role could not be assigned. Review the user before resending.",
    };
  }

  revalidatePath("/dashboard");
  return { success: `Invitation sent to ${email}.` };
}

export async function deleteUserAction(
  previousState: DeleteUserActionState,
  formData: FormData,
): Promise<DeleteUserActionState> {
  void previousState;
  const targetUserId = getString(formData, "userId");
  if (!isUuid(targetUserId)) return { error: "Invalid user." };

  const { supabase, claims } = await requireUser();
  const currentUserId = typeof claims.sub === "string" ? claims.sub : "";
  if (targetUserId === currentUserId) {
    return { error: "You cannot delete your own administrator account." };
  }

  const { data: currentRole } = await supabase
    .from("user_roles")
    .select("role")
    .eq("user_id", currentUserId)
    .maybeSingle();
  if (currentRole?.role !== "admin") return { error: "Only administrators can delete users." };

  let adminClient;
  try {
    adminClient = createAdminClient();
  } catch {
    return { error: "User management is not configured on this server." };
  }

  const { error } = await adminClient.auth.admin.deleteUser(targetUserId);
  if (error) {
    console.error("Supabase user deletion failed", {
      code: error.code,
      status: error.status,
      message: error.message,
    });
    return {
      error:
        "The user could not be deleted. Confirm the admin-deletion database migration is applied.",
    };
  }

  revalidatePath("/dashboard");
  revalidatePath("/projects");
  return {};
}
