import { CheckCircle2, MailCheck } from "lucide-react";
import { redirect } from "next/navigation";
import { confirmAuthAction } from "@/app/auth/confirm/actions";
import { Button } from "@/components/ui/button";
import { getSafePath } from "@/lib/auth/validation";

export const metadata = { title: "Confirm account" };
export const instant = false;

export default async function ConfirmAuthPage({
  searchParams,
}: {
  searchParams: Promise<{
    token_hash?: string;
    type?: string;
    code?: string;
    next?: string;
  }>;
}) {
  const params = await searchParams;

  if (!params.token_hash && !params.code) {
    redirect(
      "/auth/error?error=This%20link%20is%20incomplete%20or%20has%20already%20been%20used.",
    );
  }

  const isInvite = params.type === "invite";
  const isRecovery = params.type === "recovery";
  const title = isInvite
    ? "You’re invited to the workroom"
    : isRecovery
      ? "Confirm your password reset"
      : "Confirm your email";
  const description = isInvite
    ? "Accept your invitation to verify your email and create your password."
    : isRecovery
      ? "Continue to verify this request and choose a new password."
      : "Continue to verify your email address securely.";

  return (
    <div className="text-center">
      <span className="mx-auto grid size-14 place-items-center rounded-2xl bg-pink-50 text-pink-600">
        <MailCheck aria-hidden="true" className="size-7" />
      </span>
      <h1 className="mt-5 text-3xl font-semibold tracking-tight text-slate-950">
        {title}
      </h1>
      <p className="mx-auto mt-3 max-w-sm text-sm leading-6 text-slate-600">
        {description}
      </p>

      <form action={confirmAuthAction} className="mt-8">
        <input name="tokenHash" type="hidden" value={params.token_hash ?? ""} />
        <input name="type" type="hidden" value={params.type ?? ""} />
        <input name="code" type="hidden" value={params.code ?? ""} />
        <input name="next" type="hidden" value={getSafePath(params.next ?? null)} />
        <Button className="h-11 w-full bg-pink-600 hover:bg-pink-500" type="submit">
          <CheckCircle2 aria-hidden="true" />
          {isInvite ? "Accept invitation" : "Continue securely"}
        </Button>
      </form>

      <p className="mt-5 text-xs leading-5 text-slate-500">
        This extra confirmation protects one-time links from automated email scanners.
      </p>
    </div>
  );
}
