import type { Metadata } from "next";
import { PublicShell } from "@/components/public-shell/public-shell";
import { InviteAcceptance } from "@/features/places/place-access";

export const metadata: Metadata = { title: "Accept invitation", robots: { follow: false, index: false } };

export default async function AcceptInvitePage({ params, searchParams }: { params: Promise<{ placeSlug: string }>; searchParams: Promise<{ token?: string | string[] }> }) {
  const { placeSlug } = await params;
  const query = await searchParams;
  return <PublicShell><main className="auth-page" id="main-content"><InviteAcceptance placeSlug={placeSlug} token={typeof query.token === "string" ? query.token : undefined} /></main></PublicShell>;
}