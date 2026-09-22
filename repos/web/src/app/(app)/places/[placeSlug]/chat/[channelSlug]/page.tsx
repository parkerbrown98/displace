import { PublicShell } from "@/components/public-shell/public-shell";
import { ChatChannel } from "@/features/chat/chat-channel";

export default async function ChatPage({ params }: PageProps<"/places/[placeSlug]/chat/[channelSlug]">) {
  const { channelSlug, placeSlug } = await params;
  return <PublicShell><ChatChannel channelSlug={channelSlug} placeSlug={placeSlug} /></PublicShell>;
}