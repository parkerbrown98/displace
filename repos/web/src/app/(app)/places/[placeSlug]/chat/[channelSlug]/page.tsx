import { FeatureRoute, labelFromSlug } from "@/components/feature-route";

export default async function ChatPage({ params }: PageProps<"/places/[placeSlug]/chat/[channelSlug]">) {
  const { channelSlug } = await params;
  return <FeatureRoute eyebrow="Chat" title={labelFromSlug(channelSlug)} description="Channel history and realtime messages will appear here." />;
}