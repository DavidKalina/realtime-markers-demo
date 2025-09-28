import { Toaster } from "@/components/ui/toaster";
import { AuthProvider } from "@/contexts/AuthContext";
import { MunicipalConfigProvider } from "@/contexts/MunicipalConfigContext";
import { ToastProvider } from "@/contexts/ToastContext";
import type { Metadata } from "next";
import { Poppins } from "next/font/google";
import "./globals.css";

const poppins = Poppins({
  subsets: ["latin"],
  weight: ["400", "700"],
  variable: "--font-poppins",
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
    <html lang="en" className="min-h-screen bg-gray-50">
      <body
        className={`${poppins.className} min-h-screen bg-gray-50 flex flex-col`}
      >
        <ToastProvider>
          <MunicipalConfigProvider>
            <AuthProvider>{children}</AuthProvider>
          </MunicipalConfigProvider>
          <Toaster />
        </ToastProvider>
      </body>
    </html>
  );
}
