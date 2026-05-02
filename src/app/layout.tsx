import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Agora — an ideas feed",
  description:
    "A daily question in philosophy, history, or sociology — paired with a small bibliography and a reading companion you can talk to.",
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" className="h-full antialiased">
      <body className="min-h-full bg-stone-50 text-stone-900">{children}</body>
    </html>
  );
}
