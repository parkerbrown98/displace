import { AppShell, ShellTopbar } from "@/components/app-shell/app-shell";
import { createCommunityFixture } from "@/features/community/community-fixtures";

interface FeatureRouteProps {
  activeNavigation?: "discover" | "home" | "saved";
  description: string;
  eyebrow: string;
  title: string;
}

export function FeatureRoute({
  activeNavigation,
  description,
  eyebrow,
  title,
}: FeatureRouteProps) {
  const fixture = createCommunityFixture();

  return (
    <AppShell activeNavigation={activeNavigation} fixture={fixture}>
      <main className="main-content" id="main-content">
        <ShellTopbar />
        <section className="route-placeholder">
          <p className="eyebrow">{eyebrow}</p>
          <h1>{title}</h1>
          <p>{description}</p>
        </section>
      </main>
    </AppShell>
  );
}

export function labelFromSlug(slug: string): string {
  return slug
    .split("-")
    .filter(Boolean)
    .map((part) => part[0]?.toUpperCase() + part.slice(1))
    .join(" ");
}