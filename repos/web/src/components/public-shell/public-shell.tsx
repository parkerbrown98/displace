import { Search } from "lucide-react";
import Link from "next/link";
import type { ReactNode } from "react";
import { routes } from "@/lib/routes";

export function PublicShell({ children }: { children: ReactNode }) {
  const singlePlace = Boolean(process.env.NEXT_PUBLIC_SINGLE_PLACE_SLUG);
  return (
    <div className="public-shell">
      <header className="public-header">
        <Link className="brand" href={routes.home} aria-label="Displace home">
          <span className="brand-mark">D</span>
          <span>Displace</span>
        </Link>
        <nav aria-label="Public navigation">
          {!singlePlace ? <Link href={routes.discover}>Discover</Link> : null}
          <form action={routes.search} role="search">
            <Search size={17} aria-hidden="true" />
            <label className="sr-only" htmlFor="public-search">Search discussions</label>
            <input id="public-search" name="q" placeholder="Search" type="search" />
          </form>
          <Link className="secondary-button" href={routes.signIn}>Sign in</Link>
        </nav>
      </header>
      {children}
    </div>
  );
}