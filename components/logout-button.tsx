import { LogOut } from "lucide-react";
import { signOutAction } from "@/app/auth/actions";
import { Button } from "@/components/ui/button";

export function LogoutButton() {
  return <form action={signOutAction}><Button className="gap-2" type="submit" variant="outline"><LogOut aria-hidden="true" className="size-4" />Sign out</Button></form>;
}
