import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { Toaster } from "@/components/ui/sonner";
import { FileTreeProvider } from "@/components/providers/fileTreeProvider";
import { AuthProvider } from "@/lib/auth/authContext";
import { ThemeProvider } from "@/lib/contexts/theme-context";
import { PublicEnvScript } from "next-runtime-env";
import { QueryProvider } from "@/components/providers/query-provider";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "RefMD - Collaborative Markdown Editor",
  description: "A real-time collaborative markdown editor with live preview",
  icons: {
    icon: "/favicon.ico",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="h-full" suppressHydrationWarning>
      <head>
        <PublicEnvScript />
      </head>
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased h-full`}
      >
        <ThemeProvider>
          <QueryProvider>
            <AuthProvider>
              <FileTreeProvider>
                {children}
                <Toaster />
              </FileTreeProvider>
            </AuthProvider>
          </QueryProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
