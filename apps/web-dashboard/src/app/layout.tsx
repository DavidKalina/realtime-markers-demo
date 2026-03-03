import { Toaster } from "@/components/ui/toaster";
import { AuthProvider } from "@/contexts/AuthContext";
import { ToastProvider } from "@/contexts/ToastContext";
import type { Metadata } from "next";
import { Space_Mono } from "next/font/google";
import "./globals.css";

const spaceMono = Space_Mono({
  subsets: ["latin"],
  weight: ["400", "700"],
  variable: "--font-space-mono",
});

export const metadata: Metadata = {
  title: "A Third Space",
  description: "A Third Space Admin Dashboard",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className={`min-h-screen ${spaceMono.variable}`}>
      <body className="min-h-screen flex flex-col font-space-mono">
        <ToastProvider>
          <AuthProvider>{children}</AuthProvider>
          <Toaster />
        </ToastProvider>
      </body>
    </html>
  );
}
