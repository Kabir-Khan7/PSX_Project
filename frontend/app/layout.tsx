import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "PSX Analysis — Pakistan Stock Intelligence",
  description: "AI-powered market research for Pakistani investors",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}