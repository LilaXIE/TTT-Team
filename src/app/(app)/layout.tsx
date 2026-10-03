import { AppShell } from "@/components/app/shell";

export default function AppLayout({ children }: { children: React.ReactNode }) {
  return <AppShell demoMode={process.env.DEMO_MODE === "true"}>{children}</AppShell>;
}
