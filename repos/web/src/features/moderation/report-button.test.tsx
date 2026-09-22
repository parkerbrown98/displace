import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { useSession } from "@/features/auth/session-provider";
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
    render(<ReportButton label="post 2" placeId="place-id" targetId="post-id" targetType="post" />);

    await user.click(screen.getByRole("button", { name: "Report post 2" }));
    await user.selectOptions(screen.getByLabelText("Reason"), "harassment");
    await user.type(screen.getByLabelText("Details"), "Repeated unwanted replies.");
    await user.click(screen.getByRole("button", { name: "Submit report" }));

    expect(createReport).toHaveBeenCalledWith("place-id", {
      details: "Repeated unwanted replies.",
      reasonCode: "harassment",
      targetId: "post-id",
      targetType: "post",
    });
    expect(await screen.findByRole("status")).toHaveTextContent("Report submitted.");
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
});