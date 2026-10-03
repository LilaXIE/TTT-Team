import { redirect } from "next/navigation";
import { getSession } from "@/server/auth/session";
import { AppShell } from "@/components/app-shell";
import { ProfileManager } from "./profile-manager";

export default async function ProfilePage() {
  const user = await getSession();
  if (!user) redirect("/login");
  return <AppShell user={user}><ProfileManager /></AppShell>;
}
