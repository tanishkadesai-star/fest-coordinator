import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Fest Coordinator",
  description: "Plan your college fest and make sure every request has exactly one owner.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
