import { AppShell, ShellTopbar } from "@/components/app-shell/app-shell";

interface FeatureRouteProps {
  activeNavigation?: "discover" | "home" | "saved";
  activePlaceSlug?: string;
  description: string;
  eyebrow: string;
  title: string;
}

export function FeatureRoute({
  activeNavigation,
  activePlaceSlug,
  description,
  eyebrow,
  title,
}: FeatureRouteProps) {
  return (
    <AppShell activeNavigation={activeNavigation} activePlaceSlug={activePlaceSlug}>
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