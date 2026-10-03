import type { Metadata } from "next";
import { Inter, Newsreader } from "next/font/google";
import { cookies } from "next/headers";
import "lxgw-wenkai-webfont/lxgwwenkai-regular.css";
import "misans/lib/Normal/MiSansVF.min.css";
import { Toaster } from "@/components/ui/sonner";
import { LangProvider } from "@/lib/i18n";
import { LANG_COOKIE, type Lang } from "@/lib/lang";
import "./globals.css";

const inter = Inter({ subsets: ["latin"], variable: "--font-inter" });
const newsreader = Newsreader({ subsets: ["latin"], variable: "--font-newsreader", style: ["normal", "italic"] });

export const metadata: Metadata = {
  title: "Mandate Wallet · Zev",
  description: "HacKU 2026 · FinTech PS1 · Agentic Commerce",
};

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const lang: Lang = (await cookies()).get(LANG_COOKIE)?.value === "en" ? "en" : "zh";
  return (
    <html lang={lang === "zh" ? "zh-Hans" : "en"} className={`${inter.variable} ${newsreader.variable} h-full antialiased`}>
      <body className="flex min-h-full flex-col bg-canvas text-ink">
        <LangProvider initial={lang}>
          {children}
          <Toaster position="top-center" />
        </LangProvider>
      </body>
    </html>
  );
}
