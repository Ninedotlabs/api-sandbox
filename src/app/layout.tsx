import type { Metadata } from "next";
import { Bricolage_Grotesque, IBM_Plex_Mono, IBM_Plex_Sans } from "next/font/google";
import Script from "next/script";
import { ImportBanner } from "@/components/migrate/import-banner";
import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import "./globals.css";

// One type system across the product and the landing page: Bricolage for headlines,
// IBM Plex Sans for reading, IBM Plex Mono for anything that is code or an address.
const display = Bricolage_Grotesque({ subsets: ["latin"], weight: ["700", "800"], variable: "--font-bricolage" });
const sans = IBM_Plex_Sans({ subsets: ["latin"], weight: ["400", "500", "600"], variable: "--font-plex-sans" });
const mono = IBM_Plex_Mono({ subsets: ["latin"], weight: ["400", "500"], variable: "--font-plex-mono" });

export const metadata: Metadata = {
  title: "Universal API",
  description: "Build an API without writing code",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning className={`${display.variable} ${sans.variable} ${mono.variable}`}>
      <head>
        <Script id="theme-init" strategy="beforeInteractive">
          {`try{const t=localStorage.getItem("universal-api-theme");const d=t!=="light";document.documentElement.classList.toggle("dark",d);document.documentElement.style.colorScheme=d?"dark":"light"}catch{document.documentElement.classList.add("dark");document.documentElement.style.colorScheme="dark"}`}
        </Script>
      </head>
      <body>
        <TooltipProvider delayDuration={200}>
          <ImportBanner />
          {children}
        </TooltipProvider>
        <Toaster />
      </body>
    </html>
  );
}
