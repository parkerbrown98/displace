import { PublicShell } from "@/components/public-shell/public-shell";
import { CreateTopicScreen } from "@/features/forums/create-topic-form";

export default async function CreateTopicPage({ params }: PageProps<"/places/[placeSlug]/topics/new">) {
  const { placeSlug } = await params;
  return <PublicShell><CreateTopicScreen placeId={placeSlug} /></PublicShell>;
}