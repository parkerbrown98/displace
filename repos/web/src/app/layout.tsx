import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Displace",
  description: "Open communities built for durable conversation.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
