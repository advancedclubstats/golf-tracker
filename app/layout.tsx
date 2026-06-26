import type { Metadata, Viewport } from "next";
import {
  Hanken_Grotesk,
  Martian_Mono,
  Bricolage_Grotesque,
} from "next/font/google";
import { Analytics } from "@vercel/analytics/next";
import { Toaster } from "@/components/ui/sonner";
import { BottomNav } from "@/components/nav/BottomNav";
import { SandboxBootstrap } from "@/components/SandboxBootstrap";
import { WelcomeOverlay } from "@/components/WelcomeOverlay";
import { isOwner } from "@/lib/auth/owner";
import { getOwnerShotCount } from "@/lib/db/shots";
import { TAGLINE } from "@/lib/constants";
import "./globals.css";

// Modern Clubhouse type system: Hanken (UI/body), Martian Mono (data/stats),
// Bricolage Grotesque (display headings). The mono keeps the --font-geist-mono
// variable name so @theme inline's --font-mono mapping needs no change.
const sans = Hanken_Grotesk({
  variable: "--font-sans",
  subsets: ["latin"],
});

const mono = Martian_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

const heading = Bricolage_Grotesque({
  variable: "--font-heading-bricolage",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  // Absolute base so Next resolves the auto-wired opengraph-image/twitter-image
  // (and any relative URLs) to full https://roundrecall.com paths when shared.
  metadataBase: new URL("https://roundrecall.com"),
  title: "Round Recall",
  description: TAGLINE,
  manifest: "/manifest.json",
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "Round Recall",
  },
  openGraph: {
    title: "Round Recall",
    description: TAGLINE,
    url: "/",
    siteName: "Round Recall",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "Round Recall",
    description: TAGLINE,
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: "#F6F3EC",
};

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  // Owner gate + the splash credential count (Matt's real shots, all scopes) in
  // parallel — the count is a cheap head-only query.
  const [owner, ownerShotCount] = await Promise.all([
    isOwner(),
    getOwnerShotCount(),
  ]);
  return (
    <html
      lang="en"
      className={`${sans.variable} ${mono.variable} ${heading.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col bg-background text-foreground">
        {children}
        <BottomNav />
        {!owner && <SandboxBootstrap />}
        <WelcomeOverlay owner={owner} shotCount={ownerShotCount} />
        <Toaster />
        <Analytics />
      </body>
    </html>
  );
}
