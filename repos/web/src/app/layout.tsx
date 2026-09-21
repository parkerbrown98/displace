import type { Metadata } from "next";
import { SessionProvider } from "@/features/auth/session-provider";
import "./globals.css";

export const metadata: Metadata = {
  title: {
    default: "Displace",
    template: "%s | Displace",
  },
  description: "Open communities built for durable conversation.",
};

export default function RootLayout({
  children,
  modal,
}: Readonly<{
  children: React.ReactNode;
  modal: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body>
        <a className="skip-link" href="#main-content">Skip to content</a>
        <SessionProvider>
          {children}
          {modal}
        </SessionProvider>
        <div className="toast-region" id="toast-region" aria-live="polite" aria-atomic="true" />
      </body>
    </html>
  );
}
