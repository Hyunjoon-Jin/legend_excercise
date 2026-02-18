import type { Metadata } from "next";
import "./globals.css";
import { cn } from "@/lib/utils";

export const metadata: Metadata = {
  title: "Legend Workout Room",
  description: "Official workout certification platform for Legend Workout Room",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ko">
      <body className={cn("min-h-screen bg-background font-sans antialiased text-primary")}>
        <div className="mx-auto max-w-[480px] min-h-screen bg-background shadow-xl">
          {children}
        </div>
      </body>
    </html>
  );
}
