import { FeatureRoute, labelFromSlug } from "@/components/feature-route";

export default async function ForumPage({ params }: PageProps<"/places/[placeSlug]/forums/[forumSlug]">) {
  const { forumSlug } = await params;
  return <FeatureRoute eyebrow="Forum" title={labelFromSlug(forumSlug)} description="Forum topics will be listed here." />;
}