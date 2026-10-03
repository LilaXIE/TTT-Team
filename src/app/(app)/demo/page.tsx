import { notFound } from "next/navigation";
import { DemoPanel } from "./demo-panel";

export default function DemoPage() {
  if (process.env.DEMO_MODE !== "true") notFound();
  return <DemoPanel />;
}
