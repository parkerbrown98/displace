import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { http, HttpResponse } from "msw";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createAuthenticationFixture } from "@/features/auth/auth-fixtures";
import { SessionProvider } from "@/features/auth/session-provider";
import { resetAuthenticationForTests, signIn } from "@/features/auth/auth-client";
import { mockServer } from "@/test/mocks/server";
import { forumNavigationFixture } from "@/features/public-content/public-fixtures";
import { memberFixture, pendingMemberFixture, placeContextFixture, placeContractFixture, placeInvitesFixture, placeMembersFixture, placeRolesFixture } from "./place-fixtures";
import { InviteAcceptance, PlaceMembershipButton } from "./place-access";
import { PlaceMembers } from "./place-members";
import { CreatePlacePanel, PlaceSettings, PlaceSettingsIndex, PlaceSettingsLayout } from "./place-settings";

const router = vi.hoisted(() => ({ push: vi.fn(), refresh: vi.fn(), replace: vi.fn() }));

vi.mock("next/navigation", () => ({
  usePathname: () => "/places/game-makers/settings/identity",
  useRouter: () => router,
}));

describe("place management", () => {
  let createdForumGroup: unknown;
  let createdForum: unknown;
  let updatedSettings: unknown;

  beforeEach(async () => {
    createdForumGroup = undefined;
    createdForum = undefined;
    updatedSettings = undefined;
    mockServer.use(
      http.post("http://localhost:3001/api/v1/auth/login", () => HttpResponse.json(createAuthenticationFixture())),
      http.post("http://localhost:3001/api/v1/auth/refresh", () => HttpResponse.json(createAuthenticationFixture())),
      http.get("http://localhost:3001/api/v1/places/game-makers/context", () => HttpResponse.json(placeContextFixture)),
      http.get("http://localhost:3001/api/v1/places/0199-0000-7000-8000-000000000001/context", () => HttpResponse.json(placeContextFixture)),
      http.get("http://localhost:3001/api/v1/places/0199-0000-7000-8000-000000000001/roles", () => HttpResponse.json({ items: placeRolesFixture })),
      http.get("http://localhost:3001/api/v1/places/0199-0000-7000-8000-000000000001/forums", () => HttpResponse.json(forumNavigationFixture)),
      http.post("http://localhost:3001/api/v1/places/0199-0000-7000-8000-000000000001/forum-groups", async ({ request }) => {
        createdForumGroup = await request.json();
        return HttpResponse.json({ ...createdForumGroup as object, forums: [], id: "01990000-7000-8000-8000-000000000120" }, { status: 201 });
      }),
      http.post("http://localhost:3001/api/v1/places/0199-0000-7000-8000-000000000001/forums", async ({ request }) => {
        createdForum = await request.json();
        return HttpResponse.json({ ...createdForum as object, id: "01990000-7000-8000-8000-000000000121" }, { status: 201 });
      }),
      http.get("http://localhost:3001/api/v1/places/0199-0000-7000-8000-000000000001/members", ({ request }) => {
        const status = new URL(request.url).searchParams.get("status");
        return HttpResponse.json({ items: status === "pending" ? [pendingMemberFixture] : placeMembersFixture });
      }),
      http.get("http://localhost:3001/api/v1/places/0199-0000-7000-8000-000000000001/invites", () => HttpResponse.json({ items: placeInvitesFixture })),
      http.post(`http://localhost:3001/api/v1/places/0199-0000-7000-8000-000000000001/members/${pendingMemberFixture.id}/approve`, () => HttpResponse.json({ ...pendingMemberFixture, status: "active" })),
      http.post("http://localhost:3001/api/v1/places", async ({ request }) => HttpResponse.json({
        ...placeContractFixture,
        ...await request.json() as object,
        id: "created-place",
      })),
      http.patch("http://localhost:3001/api/v1/places/0199-0000-7000-8000-000000000001/settings", async ({ request }) => {
        updatedSettings = await request.json();
        return HttpResponse.json(placeContractFixture);
      }),
      http.post("http://localhost:3001/api/v1/places/game-makers/invites/accept", () => HttpResponse.json({ memberId: memberFixture.id, status: "active" })),
    );
    await signIn({ identifier: "parker", password: "correct horse battery staple" });
  });

  afterEach(() => {
    resetAuthenticationForTests();
    router.push.mockReset(); router.refresh.mockReset(); router.replace.mockReset();
    vi.unstubAllEnvs();
  });

  it("uses server-shaped capabilities for member and management actions", async () => {
    render(<SessionProvider><PlaceMembershipButton place={placeContractFixture} /></SessionProvider>);
    expect(await screen.findByRole("button", { name: "Leave" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Leave" })).toHaveAttribute("title", "Transfer ownership before leaving");
  });

  it("joins an open place and reacts as a member", async () => {
    let joined = false;
    mockServer.use(
      http.get("http://localhost:3001/api/v1/places/0199-0000-7000-8000-000000000001/context", () => joined ? HttpResponse.json(placeContextFixture) : HttpResponse.json({ status: 403, title: "Forbidden" }, { status: 403 })),
      http.post("http://localhost:3001/api/v1/places/0199-0000-7000-8000-000000000001/join", () => { joined = true; return HttpResponse.json({ memberId: "member-id", status: "active" }); }),
    );
    const user = userEvent.setup();
    render(<SessionProvider><PlaceMembershipButton place={placeContractFixture} /></SessionProvider>);

    await user.click(await screen.findByRole("button", { name: "Join" }));

    expect(await screen.findByRole("button", { name: "Leave" })).toBeInTheDocument();
  });

  it("leaves a place and returns to the join state", async () => {
    mockServer.use(
      http.get("http://localhost:3001/api/v1/places/0199-0000-7000-8000-000000000001/context", () => HttpResponse.json({
        ...placeContextFixture,
        viewer: { ...placeContextFixture.viewer, isOwner: false },
      })),
      http.delete("http://localhost:3001/api/v1/places/0199-0000-7000-8000-000000000001/members/me", () => new HttpResponse(null, { status: 204 })),
    );
    const user = userEvent.setup();
    render(<SessionProvider><PlaceMembershipButton place={placeContractFixture} /></SessionProvider>);

    await user.click(await screen.findByRole("button", { name: "Leave" }));

    expect(await screen.findByRole("button", { name: "Join" })).toBeInTheDocument();
    expect(router.refresh).toHaveBeenCalled();
  });

  it("disables approval and invite-only membership after the relevant state", async () => {
    mockServer.use(
      http.get("http://localhost:3001/api/v1/places/0199-0000-7000-8000-000000000001/context", () => HttpResponse.json({ status: 403, title: "Forbidden" }, { status: 403 })),
      http.post("http://localhost:3001/api/v1/places/0199-0000-7000-8000-000000000001/join", () => HttpResponse.json({ memberId: "member-id", status: "pending" })),
    );
    const user = userEvent.setup();
    const { rerender } = render(<SessionProvider><PlaceMembershipButton place={{ ...placeContractFixture, joinPolicy: "approval" }} /></SessionProvider>);
    await user.click(await screen.findByRole("button", { name: "Request to join" }));
    expect(await screen.findByRole("button", { name: "Request sent" })).toBeDisabled();

    rerender(<SessionProvider><PlaceMembershipButton place={{ ...placeContractFixture, id: "invite-only", joinPolicy: "invite_only" }} /></SessionProvider>);
    expect(await screen.findByRole("button", { name: "Invite only" })).toBeDisabled();
  });

  it("creates a place and opens its settings", async () => {
    const user = userEvent.setup();
    render(<SessionProvider><CreatePlacePanel /></SessionProvider>);
    await screen.findByRole("heading", { name: "Create a place" });
    await user.type(screen.getByLabelText("Name"), "Tabletop Studio");
    await user.type(screen.getByLabelText("Slug"), "tabletop-studio");
    await user.type(screen.getByLabelText("Description"), "A community for tabletop makers.");
    fireEvent.click(screen.getByRole("combobox", { name: /Join policy/ }));
    fireEvent.click(screen.getByRole("option", { name: "Approval required" }));
    await user.click(screen.getByRole("button", { name: "Create place" }));
    await waitFor(() => expect(router.push).toHaveBeenCalledWith("/places/tabletop-studio/settings"));
  });

  it("configures tags used for public discovery", async () => {
    const user = userEvent.setup();
    render(<SessionProvider><PlaceSettings placeId={placeContractFixture.slug} section="preferences" /></SessionProvider>);
    await user.type(await screen.findByLabelText(/Discovery tags/), "Game Design, Accessibility");
    await user.click(screen.getByRole("button", { name: "Save preferences" }));

    await waitFor(() => expect(updatedSettings).toMatchObject({
      settings: { locale: "en-US", tags: ["Game Design", "Accessibility"], topicSort: "activity" },
    }));
  });

  it("shows role capabilities and protects the owner in member management", async () => {
    const user = userEvent.setup();
    const { unmount } = render(<SessionProvider><PlaceSettings placeId={placeContractFixture.slug} section="roles" /></SessionProvider>);
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

  it("creates forum groups and forums from place settings", async () => {
    const user = userEvent.setup();
    render(<SessionProvider><PlaceSettings placeId={placeContractFixture.slug} section="forums" /></SessionProvider>);
    expect(await screen.findByRole("heading", { name: "Forums and tags" })).toBeInTheDocument();

    const groupCreator = screen.getByText("Create forum group", { selector: "strong" }).closest("details");
    expect(groupCreator).not.toBeNull();
    await user.click(within(groupCreator!).getByText("Create forum group", { selector: "strong" }));
    await user.type(within(groupCreator!).getByLabelText("Group name"), "Community");
    await user.type(within(groupCreator!).getByLabelText("Description"), "General conversations.");
    await user.click(within(groupCreator!).getByRole("button", { name: "Create group" }));
    await waitFor(() => expect(createdForumGroup).toMatchObject({ name: "Community", description: "General conversations.", position: 0 }));

    const forumCreator = screen.getByText("Create forum", { selector: "strong" }).closest("details");
    expect(forumCreator).not.toBeNull();
    await user.click(within(forumCreator!).getByText("Create forum", { selector: "strong" }));
    await user.type(within(forumCreator!).getByLabelText("Forum name"), "Introductions");
    await user.type(within(forumCreator!).getByLabelText("Description"), "Meet the community.");
    await user.click(within(forumCreator!).getByRole("button", { name: "Create forum" }));
    await waitFor(() => expect(createdForum).toMatchObject({
      groupId: forumNavigationFixture.groups[0]?.id,
      name: "Introductions",
      visibility: "public",
    }));
  });

  it("renders settings as routed subpages", async () => {
    render(<SessionProvider><PlaceSettings placeId={placeContractFixture.slug} /></SessionProvider>);

    expect(await screen.findByRole("heading", { name: "Identity and policy" })).toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: "Community preferences" })).not.toBeInTheDocument();
    const settingsNavigation = screen.getByRole("navigation", { name: "Place settings sections" });
    expect(within(settingsNavigation).getByRole("link", { name: "Preferences" })).toHaveAttribute("href", "/places/game-makers/settings/preferences");
    expect(within(settingsNavigation).getByRole("link", { name: "Forums" })).toHaveAttribute("href", "/places/game-makers/settings/forums");
  });

  it("opens the first section allowed by the viewer's capabilities", async () => {
    mockServer.use(
      http.get("http://localhost:3001/api/v1/places/game-makers/context", () => HttpResponse.json({
        ...placeContextFixture,
        viewer: { ...placeContextFixture.viewer, permissions: ["forum.manage"] },
      })),
    );

    render(<SessionProvider><PlaceSettingsLayout placeId="game-makers"><PlaceSettingsIndex /></PlaceSettingsLayout></SessionProvider>);

    await waitFor(() => expect(router.replace).toHaveBeenCalledWith("/places/game-makers/settings/forums"));
    const settingsNavigation = screen.getByRole("navigation", { name: "Place settings sections" });
    expect(within(settingsNavigation).getByRole("link", { name: "Forums" })).toBeInTheDocument();
    expect(within(settingsNavigation).queryByRole("link", { name: "Identity" })).not.toBeInTheDocument();
  });

  it("accepts an invitation and navigates to the place", async () => {
    const user = userEvent.setup();
    render(<SessionProvider><InviteAcceptance placeSlug="game-makers" token="fixture-invite-token-0123456789abcdef" /></SessionProvider>);
    await user.click(await screen.findByRole("button", { name: "Accept invitation" }));
    await waitFor(() => expect(router.replace).toHaveBeenCalledWith("/places/game-makers"));
  });

  it("refreshes stale capabilities after a forbidden update", async () => {
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