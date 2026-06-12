import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

// Customized metadata text for AcadNexus
export const metadata: Metadata = {
  title: "AcadNexus Portal | Batanes State College",
  description: "Central Login and Role Management Portal for Batanes State College",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      {/* Note: The manual <head> link tag is removed because Next.js automatically 
        discovers, generates, and injects 'icon.png' when placed inside the app folder.
      */}
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}
