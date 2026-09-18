import { SignUpForm } from "@/components/sign-up-form";
import { redirectIfAuthenticated } from "@/lib/auth/session";

export const instant = false;

export default async function SignUpPage() {
  await redirectIfAuthenticated();
  return <SignUpForm />;
}
