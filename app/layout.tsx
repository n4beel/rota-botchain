import type { Metadata, Viewport } from "next";
import { Urbanist, Geologica, Sono } from "next/font/google";
import { EvmProvider } from "@/components/providers/EvmProvider";
import { ToastProvider } from "@/components/ui/Toast";
import WrongNetworkBar from "@/components/botchain/WrongNetworkBar";
import { app } from "@/lib/app-config";
import "./globals.css";

const urbanist = Urbanist({
  variable: "--font-urbanist",
  subsets: ["latin"],
  display: "swap",
});

const geologica = Geologica({
  variable: "--font-geologica",
  subsets: ["latin"],
  display: "swap",
});

const sono = Sono({
  variable: "--font-sono",
  subsets: ["latin"],
  display: "swap",
});

export const metadata: Metadata = {
  title: `${app.name} — ${app.tagline}`,
  description: app.tagline,
  openGraph: { title: app.name, description: app.tagline, type: "website", url: app.url },
};

/** `width=device-width` plus a floor on zoom. Pinch-zoom stays available; nothing is locked out. */
export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: "#1B1F3B",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html
      lang="en"
      className={`${urbanist.variable} ${geologica.variable} ${sono.variable} h-full`}
      style={{ ["--accent" as string]: app.accent }}
    >
      <body className="min-h-full antialiased font-sans" style={{ background: "var(--bg-base)" }}>
        <EvmProvider>
          <WrongNetworkBar />
          <ToastProvider>{children}</ToastProvider>
        </EvmProvider>
      </body>
    </html>
  );
}
