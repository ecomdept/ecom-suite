import { LoginForm } from "@/components/login-form";
import { redirectIfAuthenticated } from "@/lib/auth/session";
import { getSafePath } from "@/lib/auth/validation";

export const instant = false;

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ next?: string }> }) {
  await redirectIfAuthenticated();
  const params = await searchParams;
  return <LoginForm next={getSafePath(params.next ?? null)} />;
}
