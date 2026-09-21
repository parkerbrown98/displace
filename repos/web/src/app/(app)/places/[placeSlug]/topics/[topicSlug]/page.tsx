import { FeatureRoute, labelFromSlug } from "@/components/feature-route";

export default async function TopicPage({ params }: PageProps<"/places/[placeSlug]/topics/[topicSlug]">) {
  const { topicSlug } = await params;
  return <FeatureRoute eyebrow="Topic" title={labelFromSlug(topicSlug)} description="Chronological replies and topic actions will appear here." />;
}