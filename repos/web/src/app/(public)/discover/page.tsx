import type { Metadata } from "next";
import { FeatureRoute } from "@/components/feature-route";

export const metadata: Metadata = { title: "Discover" };

export default function DiscoverPage() {
  return <FeatureRoute activeNavigation="discover" eyebrow="Public places" title="Discover" description="Find communities and durable conversations." />;
}