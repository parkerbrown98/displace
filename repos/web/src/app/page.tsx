import type { Metadata } from "next";
import { AppShell } from "@/components/app-shell/app-shell";
import { HomeFeed } from "@/features/home-feed/home-feed";

export const metadata: Metadata = {
  title: "Home",
  description: "Fresh conversations from across Displace.",
};

export default function HomePage() {
  return (
    <AppShell activeNavigation="home">
      <div className="public-shell">
        <HomeFeed />
      </div>
    </AppShell>
  );
}
