import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";

import { DeviceFrame, deviceModeScript } from "@/components/device-frame";
import { ThemeProvider } from "@/components/theme-provider";
import { TooltipProvider } from "@/components/ui/tooltip";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Redfin Prototypes",
  description: "Prototypes for the Redfin Jellyfin music player.",
  // "Add to Home Screen" on iOS opens full screen, without Safari's toolbars.
  appleWebApp: { capable: true, title: "Redfin", statusBarStyle: "black-translucent" },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#ffffff" },
    { media: "(prefers-color-scheme: dark)", color: "#0a0a0a" },
  ],
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="en"
      suppressHydrationWarning
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <head>
        <script dangerouslySetInnerHTML={{ __html: deviceModeScript }} />
      </head>
      <body className="min-h-full">
        <ThemeProvider attribute="class" defaultTheme="system" enableSystem disableTransitionOnChange>
          <TooltipProvider>
            <DeviceFrame>{children}</DeviceFrame>
          </TooltipProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
