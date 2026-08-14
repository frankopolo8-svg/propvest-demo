import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Propvest | Global real estate, made personal",
  description: "A premium AI-assisted global property search experience.",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="el"><body>{children}</body></html>;
}
