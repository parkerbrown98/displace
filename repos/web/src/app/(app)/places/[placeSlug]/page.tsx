import { AppShell } from "@/components/app-shell/app-shell";
import { CommunityHome } from "@/features/community/community-home";
import { createCommunityFixture } from "@/features/community/community-fixtures";

export default async function PlacePage({ params }: PageProps<"/places/[placeSlug]">) {
  const { placeSlug } = await params;
  const fixture = createCommunityFixture();
  fixture.place.slug = placeSlug;

  return (
    <AppShell fixture={fixture}>
      <CommunityHome fixture={fixture} />
    </AppShell>
  );
}