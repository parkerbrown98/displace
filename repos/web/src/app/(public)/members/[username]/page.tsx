import { FeatureRoute, labelFromSlug } from "@/components/feature-route";

export default async function MemberPage({ params }: PageProps<"/members/[username]">) {
  const { username } = await params;
  return <FeatureRoute eyebrow="Member" title={labelFromSlug(username)} description="Public member activity and profile details." />;
}