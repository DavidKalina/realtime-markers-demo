import type { Metadata } from "next";
import { Space_Mono } from "next/font/google";
import "./globals.css";
import { AuthProvider } from "@/contexts/AuthContext";
import { MunicipalConfigProvider } from "@/contexts/MunicipalConfigContext";

const spaceMono = Space_Mono({
  subsets: ["latin"],
  weight: ["400", "700"],
  variable: "--font-space-mono",
});

export const metadata: Metadata = {
  title: "Municipal Dashboard",
  description:
    "A modern municipal services dashboard built with Next.js and shadcn/ui",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className={spaceMono.className}>
        <MunicipalConfigProvider>
          <AuthProvider>{children}</AuthProvider>
        </MunicipalConfigProvider>
      </body>
    </html>
  );
}
