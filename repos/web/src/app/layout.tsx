import type { Metadata } from "next";
import { Manrope, Sora } from "next/font/google";
import { ToastProvider } from "@/components/ui/toast";
import { SessionProvider } from "@/features/auth/session-provider";
import "./globals.css";

const manrope = Manrope({
  subsets: ["latin"],
  variable: "--font-manrope",
});

const sora = Sora({
  subsets: ["latin"],
  variable: "--font-sora",
});

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
    <html className={`${manrope.variable} ${sora.variable}`} lang="en">
      <body>
        <a className="skip-link" href="#main-content">Skip to content</a>
        <ToastProvider>
          <SessionProvider>
            {children}
            {modal}
          </SessionProvider>
        </ToastProvider>
      </body>
    </html>
  );
}
