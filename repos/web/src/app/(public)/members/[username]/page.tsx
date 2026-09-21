import type { Metadata } from "next";
import { PublicShell } from "@/components/public-shell/public-shell";
import { getPublicProfile, PublicResourceError } from "@/features/public-content/public-data";
import { handlePublicResourceError } from "@/features/public-content/public-errors";
import { ProfileView, PublicUnavailableView } from "@/features/public-content/public-views";
import { createPublicMetadata, unavailableMetadata } from "@/lib/metadata";
import { routes } from "@/lib/routes";

export async function generateMetadata({ params }: PageProps<"/members/[username]">): Promise<Metadata> {
  const { username } = await params;
  try {
    const profile = await getPublicProfile(username);
    return createPublicMetadata({
      description: `${profile.displayName} (@${profile.handle}) on Displace.`,
      path: routes.member(profile.handle),
      title: profile.displayName,
    });
  } catch (error) {
    if (error instanceof PublicResourceError && error.reason === "unavailable") return unavailableMetadata;
    handlePublicResourceError(error);
  }
}

export default async function MemberPage({ params }: PageProps<"/members/[username]">) {
  const { username } = await params;
  const profile = await loadProfile(username);
  return <PublicShell>{profile ? <ProfileView profile={profile} /> : <PublicUnavailableView />}</PublicShell>;
}

async function loadProfile(username: string) {
  try {
    return await getPublicProfile(username);
  } catch (error) {
    if (error instanceof PublicResourceError && error.reason === "unavailable") return undefined;
    handlePublicResourceError(error);
  }
}