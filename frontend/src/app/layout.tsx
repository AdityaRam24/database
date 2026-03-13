import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import "./globals_extra.css";
import { AuthProvider } from "@/context/AuthContext";
import LenisProvider from "@/components/LenisProvider";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "DB-Lighthouse AI — PostgreSQL Intelligence Platform",
  description: "Optimize storage, visualize relationships, and get AI-powered insights for your PostgreSQL database. Illuminate the blind spots in your data.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" data-scroll-behavior="smooth">
      <body className={`${geistSans.variable} ${geistMono.variable} antialiased`}>
        <AuthProvider>
          <LenisProvider>
            {children}
          </LenisProvider>
        </AuthProvider>
      </body>
    </html>
  );
}
