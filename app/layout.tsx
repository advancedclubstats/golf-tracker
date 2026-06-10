import type { Metadata, Viewport } from "next";
import {
  Hanken_Grotesk,
  Martian_Mono,
  Bricolage_Grotesque,
} from "next/font/google";
import { Toaster } from "@/components/ui/sonner";
import { WelcomeOverlay } from "@/components/WelcomeOverlay";
import { isOwner } from "@/lib/auth/owner";
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
  title: "Round Recall",
  description: "Strokes-gained golf analytics, tracked from memory",
  manifest: "/manifest.json",
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "Round Recall",
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
  const owner = await isOwner();
  return (
    <html
      lang="en"
      className={`${sans.variable} ${mono.variable} ${heading.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col bg-background text-foreground">
        {children}
        <WelcomeOverlay owner={owner} />
        <Toaster />
      </body>
    </html>
  );
}
