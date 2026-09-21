import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { http, HttpResponse } from "msw";
import { afterEach, describe, expect, it, vi } from "vitest";
import { mockServer } from "@/test/mocks/server";
import { accountSessionsFixture, createAuthenticationFixture, userProfileFixture } from "./auth-fixtures";
import { AccountSettings } from "./account-settings";
import { resetAuthenticationForTests, signIn } from "./auth-client";
import { ForgotPasswordPanel, RegisterPanel } from "./identity-panels";
import { SessionProvider } from "./session-provider";
import { SignInPanel } from "./sign-in-panel";

const router = vi.hoisted(() => ({ refresh: vi.fn(), replace: vi.fn() }));

vi.mock("next/navigation", () => ({ useRouter: () => router }));

describe("authentication journeys", () => {
  afterEach(() => {
    resetAuthenticationForTests();
    router.refresh.mockReset();
    router.replace.mockReset();
    vi.unstubAllEnvs();
  });

  it("uses account-enumeration-safe registration and recovery confirmations", async () => {
    mockServer.use(
      http.post("http://localhost:3001/api/v1/auth/register", () => HttpResponse.json(
        { message: "If registration can proceed, a verification message has been queued." },
        { status: 202 },
      )),
      http.post("http://localhost:3001/api/v1/auth/password/forgot", () => HttpResponse.json(
        { message: "If the account exists, a reset message has been queued." },
        { status: 202 },
      )),
    );
    const user = userEvent.setup();
    const { unmount } = render(<RegisterPanel />);

    await user.type(screen.getByLabelText("Display name"), "Parker");
    await user.type(screen.getByLabelText("Handle"), "parker");
    await user.type(screen.getByLabelText("Email"), "parker@example.com");
    await user.type(screen.getByLabelText("Password"), "correct horse battery staple");
    await user.click(screen.getByRole("button", { name: "Create account" }));
    expect(await screen.findByText(/If registration can proceed/)).toBeInTheDocument();

    unmount();
    render(<ForgotPasswordPanel />);
    await user.type(screen.getByLabelText("Email"), "unknown@example.com");
    await user.click(screen.getByRole("button", { name: "Send reset link" }));
    expect(await screen.findByText(/If the account exists/)).toBeInTheDocument();
  });

  it("rejects external return destinations after sign-in", async () => {
    mockServer.use(
      http.post("http://localhost:3001/api/v1/auth/refresh", () => new HttpResponse(null, { status: 401 })),
      http.post("http://localhost:3001/api/v1/auth/login", () => HttpResponse.json(createAuthenticationFixture())),
    );
    const user = userEvent.setup();
    render(<SessionProvider><SignInPanel returnTo="https://attacker.example" /></SessionProvider>);

    await user.type(screen.getByLabelText("Email or handle"), "parker");
    await user.type(screen.getByLabelText("Password"), "correct horse battery staple");
    await user.click(screen.getByRole("button", { name: "Sign in" }));

    await waitFor(() => expect(router.replace).toHaveBeenCalledWith("/"));
  });

  it("surfaces API rate limits without exposing account details", async () => {
    mockServer.use(
      http.post("http://localhost:3001/api/v1/auth/refresh", () => new HttpResponse(null, { status: 401 })),
      http.post("http://localhost:3001/api/v1/auth/login", () => HttpResponse.json(
        { status: 429, title: "Too Many Requests" },
        { status: 429 },
      )),
    );
    const user = userEvent.setup();
    render(<SessionProvider><SignInPanel /></SessionProvider>);

    await user.type(screen.getByLabelText("Email or handle"), "parker");
    await user.type(screen.getByLabelText("Password"), "incorrect-password");
    await user.click(screen.getByRole("button", { name: "Sign in" }));

    expect(await screen.findByRole("alert")).toHaveTextContent("Too many attempts");
  });

  it("revokes a device session and signs out all sessions", async () => {
    mockServer.use(
      http.post("http://localhost:3001/api/v1/auth/login", () => HttpResponse.json(createAuthenticationFixture())),
      http.post("http://localhost:3001/api/v1/auth/refresh", () => HttpResponse.json(createAuthenticationFixture())),
      http.get("http://localhost:3001/api/v1/auth/me", () => HttpResponse.json(userProfileFixture)),
      http.get("http://localhost:3001/api/v1/auth/sessions", () => HttpResponse.json(accountSessionsFixture)),
      http.delete("http://localhost:3001/api/v1/auth/sessions/01990000-7000-8000-8000-000000000602", () => new HttpResponse(null, { status: 204 })),
      http.post("http://localhost:3001/api/v1/auth/logout-all", () => new HttpResponse(null, { status: 204 })),
    );
    await signIn({ identifier: "parker", password: "correct horse battery staple" });
    const user = userEvent.setup();
    render(<SessionProvider><AccountSettings /></SessionProvider>);

    expect(await screen.findByText("Safari on iPhone")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Revoke Safari on iPhone" }));
    await waitFor(() => expect(screen.queryByText("Safari on iPhone")).not.toBeInTheDocument());

    await user.click(screen.getByRole("button", { name: "Sign out everywhere" }));
    expect(await screen.findByRole("heading", { name: "Sign in required" })).toBeInTheDocument();
    expect(router.replace).toHaveBeenCalledWith("/");
  });
});