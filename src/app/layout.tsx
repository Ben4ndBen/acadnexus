import type { Metadata } from "next";
import { Inter } from "next/font/google"; // Switched to Inter for a more academic/professional look
import "./globals.css";

// Inter is a highly readable font for academic portals
const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
});

export const metadata: Metadata = {
  title: "AcadNexus | Batanes State College",
  description: "Academic management portal for Batanes State College",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className={`${inter.variable} h-full antialiased`}>
      <body className="min-h-full flex flex-col font-sans bg-white text-slate-900">
        {children}
      </body>
    </html>
  );
}