import { PublicShell } from "@/components/public-shell/public-shell";
import { CreateTopicScreen } from "@/features/forums/create-topic-form";
import { getForumNavigation, getPublicPlace } from "@/features/public-content/public-data";

export default async function CreateTopicPage({ params }: PageProps<"/places/[placeSlug]/topics/new">) {
  const { placeSlug } = await params;
  const [place, navigation] = await Promise.all([getPublicPlace(placeSlug), getForumNavigation(placeSlug)]);
  return <PublicShell><CreateTopicScreen navigation={navigation} place={place} /></PublicShell>;
}