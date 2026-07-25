import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Propvest ChatKit Demo",
  description: "A single Next.js app with an OpenAI ChatKit interface.",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
