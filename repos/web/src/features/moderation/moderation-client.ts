import { authenticatedMutation, authenticatedRead } from "@/features/auth/auth-client";
import type {
  ActionReasonCode,
  InstanceSettingsContract,
  ModerationActionInput,
  ModerationReportContract,
  ModerationReportPageContract,
  ReportReasonCode,
  ReportStatus,
  ReportTargetType,
} from "./moderation-contracts";

const placePath = (placeId: string) => `/places/${encodeURIComponent(placeId)}`;

export function createReport(placeId: string, input: { details?: string; reasonCode: ReportReasonCode; targetId: string; targetType: ReportTargetType }): Promise<ModerationReportContract> {
  return authenticatedMutation(`${placePath(placeId)}/reports`, { body: input, method: "POST" });
}

export function listModerationReports(placeId: string, options: { assigneeUserId?: string; cursor?: string; status?: ReportStatus } = {}): Promise<ModerationReportPageContract> {
  const query = new URLSearchParams();
  if (options.assigneeUserId) query.set("assigneeUserId", options.assigneeUserId);
  if (options.cursor) query.set("cursor", options.cursor);
  if (options.status) query.set("status", options.status);
  const suffix = query.size ? `?${query}` : "";
  return authenticatedRead(`${placePath(placeId)}/moderation/reports${suffix}`);
}

export function getModerationReport(placeId: string, reportId: string): Promise<ModerationReportContract> {
  return authenticatedRead(`${placePath(placeId)}/moderation/reports/${encodeURIComponent(reportId)}`);
}

export function assignModerationReport(placeId: string, reportId: string, assigneeUserId: string): Promise<ModerationReportContract> {
  return authenticatedMutation(`${placePath(placeId)}/moderation/reports/${encodeURIComponent(reportId)}/assignment`, { body: { assigneeUserId }, method: "PATCH" });
}

export function resolveModerationReport(placeId: string, reportId: string, status: "dismissed" | "resolved", resolution: string): Promise<ModerationReportContract> {
  return authenticatedMutation(`${placePath(placeId)}/moderation/reports/${encodeURIComponent(reportId)}/resolution`, { body: { resolution, status }, method: "PATCH" });
}

export function addModeratorNote(placeId: string, reportId: string, body: string) {
  return authenticatedMutation(`${placePath(placeId)}/moderation/reports/${encodeURIComponent(reportId)}/notes`, { body: { body }, method: "POST" });
}

export function executeModerationAction(placeId: string, input: ModerationActionInput): Promise<{ actionId: string }> {
  return authenticatedMutation(`${placePath(placeId)}/moderation/actions`, { body: input, method: "POST" });
}

export function executeBulkModerationActions(placeId: string, actions: ModerationActionInput[]): Promise<{ items: Array<{ actionId: string }> }> {
  return authenticatedMutation(`${placePath(placeId)}/moderation/actions/bulk`, { body: { actions }, method: "POST" });
}

export function getInstanceSettings(): Promise<InstanceSettingsContract> {
  return authenticatedRead("/admin/settings");
}

export function updateInstanceSettings(input: { registrationMode?: InstanceSettingsContract["registrationMode"]; settings?: Record<string, unknown>; singlePlaceMode?: boolean }): Promise<InstanceSettingsContract> {
  return authenticatedMutation("/admin/settings", { body: input, method: "PATCH" });
}

export function updateAccountStatus(userId: string, action: "restore" | "suspend", input: { reason: string; reasonCode: ActionReasonCode }): Promise<{ id: string; status: "active" | "suspended" }> {
  return authenticatedMutation(`/admin/users/${encodeURIComponent(userId)}/${action}`, { body: input, method: "POST" });
}