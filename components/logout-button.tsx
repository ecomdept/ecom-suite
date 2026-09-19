import { LogOut } from "lucide-react";
import { signOutAction } from "@/app/auth/actions";
import { Button } from "@/components/ui/button";

export function LogoutButton() {
  return <form action={signOutAction}><Button aria-label="Sign out" className="gap-2 border-white/15 bg-white/[0.07] px-2 text-white/70 shadow-none hover:bg-white/15 hover:text-white sm:px-4" type="submit" variant="outline"><LogOut aria-hidden="true" className="size-4" /><span className="hidden sm:inline">Sign out</span></Button></form>;
}
