import { fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { useSession } from "@/features/auth/session-provider";
import { ToastProvider } from "@/components/ui/toast";
import { createReport } from "./moderation-client";
import { ReportButton } from "./report-button";

vi.mock("@/features/auth/session-provider", () => ({ useSession: vi.fn() }));
vi.mock("./moderation-client", () => ({ createReport: vi.fn() }));

const session = vi.mocked(useSession);

describe("ReportButton", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    session.mockReturnValue({
      refreshProfile: vi.fn(),
      signInAccount: vi.fn(),
      signOutAccount: vi.fn(),
      status: "authenticated",
      user: {
        displayName: "Parker",
        email: "parker@example.test",
        emailVerified: true,
        handle: "parker",
        id: "01990000-7000-8000-8000-000000000501",
        isInstanceAdmin: false,
      },
    });
  });

  it("submits the selected reason and reporter details", async () => {
    const user = userEvent.setup();
    vi.mocked(createReport).mockResolvedValue({ id: "report-id" } as never);
    render(<ToastProvider><ReportButton label="post 2" placeId="place-id" targetId="post-id" targetType="post" /></ToastProvider>);

    await user.click(screen.getByRole("button", { name: "Report post 2" }));
    fireEvent.click(screen.getByRole("combobox", { name: /Reason/ }));
    fireEvent.click(screen.getByRole("option", { name: "harassment" }));
    await user.type(screen.getByLabelText("Details"), "Repeated unwanted replies.");
    await user.click(screen.getByRole("button", { name: "Submit report" }));

    expect(createReport).toHaveBeenCalledWith("place-id", {
      details: "Repeated unwanted replies.",
      reasonCode: "harassment",
      targetId: "post-id",
      targetType: "post",
    });
    expect(await screen.findByText("Report submitted.")).toBeInTheDocument();
  });

  it("does not render for anonymous visitors", () => {
    session.mockReturnValue({
      refreshProfile: vi.fn(),
      signInAccount: vi.fn(),
      signOutAccount: vi.fn(),
      status: "anonymous",
      user: null,
    });
    render(<ReportButton label="topic" placeId="place-id" targetId="topic-id" targetType="topic" />);
    expect(screen.queryByRole("button", { name: "Report topic" })).not.toBeInTheDocument();
  });

  it("dismisses with Escape and restores focus to the report trigger", async () => {
    const user = userEvent.setup();
    render(<ReportButton label="topic" placeId="place-id" targetId="topic-id" targetType="topic" />);
    const trigger = screen.getByRole("button", { name: "Report topic" });

    await user.click(trigger);
    expect(screen.getByRole("dialog", { name: "Report topic" })).toBeInTheDocument();
    await user.keyboard("{Escape}");

    expect(screen.queryByRole("dialog", { name: "Report topic" })).not.toBeInTheDocument();
    expect(trigger).toHaveFocus();
  });
});