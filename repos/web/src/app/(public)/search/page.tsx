import type { Metadata } from "next";
import { FeatureRoute } from "@/components/feature-route";

export const metadata: Metadata = { title: "Search" };

export default function SearchPage() {
  return <FeatureRoute eyebrow="Search" title="Discussion results" description="Search results will be shown here." />;
}