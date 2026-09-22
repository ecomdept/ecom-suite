"use server";

import { revalidatePath } from "next/cache";
import { requireUser } from "@/lib/auth/session";
import { isUuid, parseOptionalNonnegativeNumber } from "@/lib/projects/validation";

export type CostRateActionState = { error?: string; success?: string };

export async function updateTeamCostRateAction(
  previousState: CostRateActionState,
  formData: FormData,
): Promise<CostRateActionState> {
  void previousState;
  const userIdValue = formData.get("userId");
  const costValue = formData.get("hourlyCost");
  const userId = typeof userIdValue === "string" ? userIdValue : "";
  const hourlyCost = parseOptionalNonnegativeNumber(typeof costValue === "string" ? costValue : "", 100000);
  if (!isUuid(userId)) return { error: "Invalid team member." };
  if (hourlyCost === undefined || hourlyCost === null) return { error: "Enter a valid hourly cost." };

  const { supabase, claims } = await requireUser();
  const currentUserId = typeof claims.sub === "string" ? claims.sub : "";
  const { data: roleRecord } = await supabase.from("user_roles").select("role").eq("user_id", currentUserId).maybeSingle();
  if (roleRecord?.role !== "admin") return { error: "Only administrators can update internal cost rates." };

  const { error } = await supabase.from("team_cost_rates").upsert({
    user_id: userId,
    hourly_cost: hourlyCost,
    updated_by: currentUserId,
  });
  if (error) return { error: "The internal cost rate could not be saved." };

  revalidatePath("/analytics");
  return { success: "Saved" };
}
