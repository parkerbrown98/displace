import { fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { ReactNode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { getPlaceContext, listMyPlaces } from "@/features/places/place-client";
import { placeContextFixture, placeContractFixture } from "@/features/places/place-fixtures";
import {
  getModerationReport,
  listModerationReports,
} from "./moderation-client";
import type { ModerationReportContract } from "./moderation-contracts";
import { ModerationDashboard } from "./moderation-dashboard";

vi.mock("@/components/app-shell/app-shell", () => ({
  AppShell: ({ children }: { children: ReactNode }) => <>{children}</>,
  ShellTopbar: () => null,
}));
vi.mock("@/features/auth/session-provider", () => ({
  useSession: () => ({
    status: "authenticated",
    user: { id: "moderator-id" },
  }),
}));
vi.mock("@/features/places/place-client", () => ({
  getPlaceContext: vi.fn(),
  listMyPlaces: vi.fn(),
}));
vi.mock("./moderation-client", () => ({
  addModeratorNote: vi.fn(),
  assignModerationReport: vi.fn(),
  executeBulkModerationActions: vi.fn(),
  executeModerationAction: vi.fn(),
  getModerationReport: vi.fn(),
  listModerationReports: vi.fn(),
  resolveModerationReport: vi.fn(),
}));

const report: ModerationReportContract = {
  actions: [],
  assignedToUserId: null,
  createdAt: "2026-09-22T12:00:00.000Z",
  details: "Repeated unwanted contact after a clear request to stop.",
  evidence: { displayName: "Mara V.", handle: "mara", status: "active" },
  id: "01990000-7000-8000-8000-000000000080",
  notes: [],
  placeId: placeContractFixture.id,
  reasonCode: "harassment",
  reporterUserId: "01990000-7000-8000-8000-000000000081",
  resolution: null,
  resolvedAt: null,
  status: "open",
  targetId: "01990000-7000-8000-8000-000000000020",
  targetType: "member",
  updatedAt: "2026-09-22T12:00:00.000Z",
};

describe("ModerationDashboard", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(listMyPlaces).mockResolvedValue({ items: [placeContractFixture] });
    vi.mocked(getPlaceContext).mockResolvedValue(placeContextFixture);
    vi.mocked(listModerationReports).mockResolvedValue({ items: [report] });
    vi.mocked(getModerationReport).mockResolvedValue(report);
  });

  it("moves from a scannable queue into a focused case workflow", async () => {
    const user = userEvent.setup();
    render(<ModerationDashboard />);

    expect(await screen.findByRole("heading", { name: "Open reports" })).toBeInTheDocument();
    expect(screen.getByRole("group", { name: "Report status" })).toBeInTheDocument();
    expect(screen.getByText("Unassigned")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: /Mara V/ }));
    expect(await screen.findByRole("heading", { name: "Mara V." })).toBeInTheDocument();
    expect(screen.getByText("Repeated unwanted contact after a clear request to stop.")).toBeInTheDocument();
    expect(screen.queryByLabelText("Timeout hours")).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole("combobox", { name: "Action" }));
    fireEvent.click(screen.getByRole("option", { name: "Member timeout" }));
    expect(screen.getByLabelText("Timeout hours")).toBeInTheDocument();
  });
});