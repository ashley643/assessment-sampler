import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Impacter Report Builder",
  description: "Turn your data into compelling impact reports with AI",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className="antialiased">{children}</body>
    </html>
  );
}
