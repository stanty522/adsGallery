import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Ads Gallery",
  description: "Browse and filter ad creatives",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
