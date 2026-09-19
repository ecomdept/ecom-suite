import { UpdatePasswordForm } from "@/components/update-password-form";
import { requireUser } from "@/lib/auth/session";

export const metadata = { title: "Set password" };
export const instant = false;

export default async function SetPasswordPage() {
  await requireUser();
  return <UpdatePasswordForm flow="invite" />;
}
