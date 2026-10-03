import { LoginView } from "./login-view";

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ attacker?: string }> }) {
  const { attacker } = await searchParams;
  return <LoginView attacker={process.env.DEMO_MODE === "true" && attacker === "1"} />;
}
