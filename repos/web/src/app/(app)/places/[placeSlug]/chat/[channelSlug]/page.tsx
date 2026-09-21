import { labelFromSlug } from "@/components/feature-route";
import { PublicShell } from "@/components/public-shell/public-shell";
import { PlaceFeatureRoute } from "@/features/places/place-feature-route";
import { routes } from "@/lib/routes";

export default async function ChatPage({ params }: PageProps<"/places/[placeSlug]/chat/[channelSlug]">) {
  const { channelSlug, placeSlug } = await params;
  return <PublicShell><PlaceFeatureRoute description="Channel history and realtime messages will appear here." eyebrow="Chat channel" placeId={placeSlug} sectionHref={routes.chat(placeSlug, channelSlug)} sectionLabel="Chat" title={labelFromSlug(channelSlug)} /></PublicShell>;
}