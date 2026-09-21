import Link from "next/link";
import type { ReactNode } from "react";
import { routes } from "@/lib/routes";

export function AuthPage({ children, eyebrow, title }: { children: ReactNode; eyebrow: string; title: string }) {
  return (
    <main className="auth-page" id="main-content">
      <Link className="brand" href={routes.home} aria-label="Displace home">
        <span className="brand-mark">D</span><span>Displace</span>
      </Link>
      <section className="auth-panel">
        <p className="eyebrow">{eyebrow}</p>
        <h1>{title}</h1>
        {children}
      </section>
    </main>
  );
}