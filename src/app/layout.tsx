import type { Metadata } from "next";
import type { ReactNode } from "react";
import { Toaster } from "@/components/ui/sonner";
import "./globals.css";

export const metadata: Metadata = {
  title: "MandateWallet — 给 Agent 一个有边界的钱包",
  description: "HacKU 2026 · FinTech PS1 · Agentic Commerce",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="zh-HK" className="h-full antialiased">
      <body className="min-h-full flex flex-col bg-zinc-50 text-zinc-900">
        {children}
        <Toaster richColors position="top-center" />
      </body>
    </html>
  );
}
