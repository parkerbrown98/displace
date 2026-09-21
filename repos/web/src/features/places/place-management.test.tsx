import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { http, HttpResponse } from "msw";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createAuthenticationFixture } from "@/features/auth/auth-fixtures";
import { SessionProvider } from "@/features/auth/session-provider";
import { resetAuthenticationForTests, signIn } from "@/features/auth/auth-client";
import { mockServer } from "@/test/mocks/server";
import { placeContractFixture } from "./place-contract";
import { memberFixture, placeContextFixture, placeRolesFixture } from "./place-fixtures";
import { InviteAcceptance, PlaceMembershipActions } from "./place-access";
import { PlaceMembers } from "./place-members";
import { CreatePlacePanel, PlaceSettings } from "./place-settings";

const router = vi.hoisted(() => ({ push: vi.fn(), refresh: vi.fn(), replace: vi.fn() }));

vi.mock("next/navigation", () => ({ useRouter: () => router }));

describe("place management", () => {
  beforeEach(async () => {
    vi.stubEnv("NEXT_PUBLIC_WEB_DATA_SOURCE", "fixture");
    await signIn({ identifier: "parker", password: "correct horse battery staple" });
  });

  afterEach(() => {
    resetAuthenticationForTests();
    router.push.mockReset(); router.refresh.mockReset(); router.replace.mockReset();
    vi.unstubAllEnvs();
  });

  it("uses server-shaped capabilities for member and management actions", async () => {
    render(<SessionProvider><PlaceMembershipActions place={placeContractFixture} /></SessionProvider>);
    expect(await screen.findByRole("link", { name: "Manage" })).toHaveAttribute("href", "/places/game-makers/settings");
    expect(screen.getByRole("link", { name: "Members" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Leave" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Leave" })).toHaveAttribute("title", "Transfer ownership before leaving");
  });

  it("creates a place and opens its settings", async () => {
    const user = userEvent.setup();
    render(<SessionProvider><CreatePlacePanel /></SessionProvider>);
    await screen.findByRole("heading", { name: "Create a place" });
    await user.type(screen.getByLabelText("Name"), "Tabletop Studio");
    await user.type(screen.getByLabelText("Slug"), "tabletop-studio");
    await user.type(screen.getByLabelText("Description"), "A community for tabletop makers.");
    await user.selectOptions(screen.getByRole("combobox", { name: /Join policy/ }), "approval");
    await user.click(screen.getByRole("button", { name: "Create place" }));
    await waitFor(() => expect(router.push).toHaveBeenCalledWith("/places/tabletop-studio/settings"));
  });

  it("shows role capabilities and protects the owner in member management", async () => {
    const user = userEvent.setup();
    const { unmount } = render(<SessionProvider><PlaceSettings placeId={placeContractFixture.slug} /></SessionProvider>);
    expect(await screen.findByRole("heading", { name: "Place settings" })).toBeInTheDocument();
    await user.click(await screen.findByText("Owner"));
    expect(screen.getAllByText("System role permissions cannot be changed.").length).toBeGreaterThan(0);

    unmount();
    render(<SessionProvider><PlaceMembers placeId={placeContractFixture.slug} /></SessionProvider>);
    expect(await screen.findByRole("heading", { name: "Membership requests" })).toBeInTheDocument();
    expect(screen.getByText("The owner cannot be removed. Transfer ownership first.")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Approve" }));
    await waitFor(() => expect(screen.queryByRole("heading", { name: "Membership requests" })).not.toBeInTheDocument());
    expect(screen.getByText("Noah Park")).toBeInTheDocument();
  });

  it("accepts an invitation and navigates to the place", async () => {
    const user = userEvent.setup();
    render(<SessionProvider><InviteAcceptance placeSlug="game-makers" token="fixture-invite-token-0123456789abcdef" /></SessionProvider>);
    await user.click(await screen.findByRole("button", { name: "Accept invitation" }));
    await waitFor(() => expect(router.replace).toHaveBeenCalledWith("/places/game-makers"));
  });

  it("refreshes stale capabilities after a forbidden update", async () => {
    vi.stubEnv("NEXT_PUBLIC_WEB_DATA_SOURCE", "api");
    let contextReads = 0;
    mockServer.use(
      http.post("http://localhost:3001/api/v1/auth/refresh", () => HttpResponse.json(createAuthenticationFixture())),
      http.get("http://localhost:3001/api/v1/places/game-makers/context", () => {
        contextReads += 1;
        return HttpResponse.json(contextReads === 1 ? placeContextFixture : {
          ...placeContextFixture,
          viewer: { ...placeContextFixture.viewer, permissions: [] },
        });
      }),
      http.get("http://localhost:3001/api/v1/places/0199-0000-7000-8000-000000000001/roles", () => HttpResponse.json({ items: placeRolesFixture })),
      http.patch("http://localhost:3001/api/v1/places/0199-0000-7000-8000-000000000001", () => HttpResponse.json({ status: 403, title: "Forbidden", detail: "Place management is required." }, { status: 403 })),
    );
    const user = userEvent.setup();
    render(<SessionProvider><PlaceSettings placeId="game-makers" /></SessionProvider>);
    await user.click(await screen.findByRole("button", { name: "Save place" }));
    expect(await screen.findByRole("heading", { name: "Settings unavailable" })).toBeInTheDocument();
    expect(contextReads).toBeGreaterThanOrEqual(2);
  });

  it("suppresses place creation in single-place mode", async () => {
    vi.stubEnv("NEXT_PUBLIC_SINGLE_PLACE_SLUG", "game-makers");
    render(<SessionProvider><CreatePlacePanel /></SessionProvider>);
    expect(await screen.findByRole("heading", { name: "Place creation disabled" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Create place" })).not.toBeInTheDocument();
  });

  it("loads a place member profile from the same typed fixture", () => {
    expect(memberFixture.roles[0].permissions).toContain("member.manage");
  });
});