import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Developer Dashboard",
  description: "Your AI-powered daily briefing for software engineers.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="h-full antialiased">
      <body className="min-h-full">{children}</body>
    </html>
  );
}
