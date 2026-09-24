import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { useSession } from "@/features/auth/session-provider";
import { AppShell } from "./app-shell";

vi.mock("next/navigation", () => ({ usePathname: () => "/discover" }));
vi.mock("@/features/auth/session-provider", () => ({ useSession: vi.fn() }));
vi.mock("@/features/places/place-access", () => ({
  PlaceSwitcher: ({ activeSlug }: { activeSlug?: string }) => <div data-active-slug={activeSlug} data-testid="place-switcher" />,
}));

const session = vi.mocked(useSession);

describe("AppShell", () => {
  beforeEach(() => {
    session.mockReturnValue({
      refreshProfile: vi.fn(),
      signInAccount: vi.fn(),
      signOutAccount: vi.fn(),
      status: "anonymous",
      user: null,
    });
  });

  it("shows account calls to action without private navigation for anonymous visitors", () => {
    render(<AppShell><main>Public content</main></AppShell>);

    expect(screen.getByRole("link", { name: "Discover" })).toHaveClass("active");
    expect(screen.getByRole("link", { name: "Create account" })).toHaveAttribute("href", "/register");
    expect(screen.getByRole("link", { name: "Sign in" })).toHaveAttribute("href", "/sign-in?returnTo=%2Fdiscover");
    expect(screen.queryByRole("link", { name: "Saved" })).not.toBeInTheDocument();
    expect(screen.queryByTestId("place-switcher")).not.toBeInTheDocument();
  });

  it("shows memberships and account navigation for authenticated visitors", () => {
    session.mockReturnValue({
      refreshProfile: vi.fn(),
      signInAccount: vi.fn(),
      signOutAccount: vi.fn(),
      status: "authenticated",
      user: {
        displayName: "Ada Lovelace",
        email: "ada@example.test",
        emailVerified: true,
        handle: "ada",
        id: "user-1",
        isInstanceAdmin: false,
      },
    });

    render(<AppShell><main>Member content</main></AppShell>);

    expect(screen.getByRole("link", { name: "Saved" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Moderation" })).toBeInTheDocument();
    expect(screen.queryByRole("link", { name: "Administration" })).not.toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Your places" })).toBeInTheDocument();
    expect(screen.getByTestId("place-switcher")).toBeInTheDocument();
    expect(screen.getByText("Ada Lovelace")).toBeInTheDocument();
    expect(screen.getByText("@ada")).toBeInTheDocument();
    expect(screen.queryByRole("link", { name: "Create account" })).not.toBeInTheDocument();
  });

  it("shows instance administration only to instance administrators", () => {
    session.mockReturnValue({
      refreshProfile: vi.fn(),
      signInAccount: vi.fn(),
      signOutAccount: vi.fn(),
      status: "authenticated",
      user: {
        displayName: "Ada Lovelace",
        email: "ada@example.test",
        emailVerified: true,
        handle: "ada",
        id: "user-1",
        isInstanceAdmin: true,
      },
    });

    render(<AppShell><main>Admin content</main></AppShell>);

    expect(screen.getByRole("link", { name: "Administration" })).toHaveAttribute("href", "/admin");
  });

  it("opens and closes the mobile navigation menu", async () => {
    const user = userEvent.setup();
    render(<AppShell><main>Public content</main></AppShell>);

    await user.click(screen.getByRole("button", { name: "Open navigation" }));
    const dialog = screen.getByRole("dialog", { name: "Navigation" });
    expect(dialog).toBeInTheDocument();
    expect(dialog).toHaveTextContent("Join the conversation");

    await user.click(screen.getByRole("button", { name: "Close navigation" }));
    expect(screen.queryByRole("dialog", { name: "Navigation" })).not.toBeInTheDocument();
  });
});