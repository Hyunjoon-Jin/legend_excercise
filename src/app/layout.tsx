import type { Metadata } from "next";
import "./globals.css";
import { cn } from "@/lib/utils";
import { AuthProvider } from "@/components/auth-provider";

export const metadata: Metadata = {
  title: "Legend Workout Room",
  description: "Official workout certification platform for Legend Workout Room",
  manifest: "/manifest.json",
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "Legend 운동인증방",
  },
};

export const viewport = {
  themeColor: "#000000",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ko">
      <head>
        <link rel="manifest" href="/manifest.json" />
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="default" />
        <meta name="apple-mobile-web-app-title" content="Legend" />
        <link rel="apple-touch-icon" href="/icon-192x192.png" />
      </head>
      <body className={cn("min-h-screen bg-background font-sans antialiased text-primary")}>
        <div className="mx-auto max-w-[480px] min-h-screen bg-background shadow-xl">
          <AuthProvider>{children}</AuthProvider>
        </div>
      </body>
    </html>
  );
}
