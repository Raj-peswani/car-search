import type { Metadata } from "next";

import "./globals.css";
import { Providers } from "@/components/providers";
import { NavSidebar } from "@/components/nav-sidebar";
import { Toaster } from "@/components/ui/sonner";

export const metadata: Metadata = {
  title: "SoCal Deal Finder",
  description: "Find affordable used cars in Southern California",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className="h-full antialiased"
    >
      <body className="min-h-full bg-background text-foreground">
        <Providers>
          <NavSidebar />
          {/* Desktop: offset for sidebar; mobile: offset for bottom nav */}
          <main className="pb-16 md:ml-16 md:pb-0">
            <div className="mx-auto max-w-6xl p-4 md:p-6">{children}</div>
          </main>
          <Toaster />
        </Providers>
      </body>
    </html>
  );
}
