export const reportReasonCodes = [
  "spam",
  "harassment",
  "hate",
  "dangerous",
  "sexual",
  "privacy",
  "impersonation",
  "other",
] as const;

export const actionReasonCodes = [
  "policy_violation",
  "spam",
  "harassment",
  "hate",
  "safety",
  "ban_evasion",
  "other",
] as const;

export type ReportReasonCode = (typeof reportReasonCodes)[number];
export type ActionReasonCode = (typeof actionReasonCodes)[number];
export type ReportTargetType = "chat_message" | "member" | "place" | "post" | "topic";
export type ReportStatus = "dismissed" | "in_review" | "open" | "resolved";
export type ModerationActionName =
  | "chat.delete"
  | "content.hide"
  | "content.restore"
  | "member.ban"
  | "member.timeout"
  | "member.warn"
  | "topic.lock"
  | "topic.move"
  | "topic.pin"
  | "topic.unlock"
  | "topic.unpin";

export interface ModerationNoteContract {
  authorUserId: string;
  body: string;
  createdAt: string;
  id: string;
}

export interface ModerationActionContract {
  action: ModerationActionName;
  actorUserId: string;
  after: Record<string, unknown>;
  before: Record<string, unknown>;
  createdAt: string;
  id: string;
  reason: string;
  reasonCode: ActionReasonCode;
  targetId: string;
  targetType: string;
}

export interface ModerationReportContract {
  actions?: ModerationActionContract[];
  assignedToUserId: string | null;
  createdAt: string;
  details: string;
  evidence: Record<string, unknown>;
  id: string;
  notes?: ModerationNoteContract[];
  placeId: string;
  reasonCode: ReportReasonCode;
  reporterUserId: string;
  resolution: string | null;
  resolvedAt: string | null;
  status: ReportStatus;
  targetId: string;
  targetType: ReportTargetType;
  updatedAt: string;
}

export interface ModerationReportPageContract {
  items: ModerationReportContract[];
  nextCursor?: string;
}

export interface ModerationActionInput {
  action: ModerationActionName;
  durationHours?: number;
  reason: string;
  reasonCode: ActionReasonCode;
  reportId?: string;
  targetForumId?: string;
  targetId: string;
  targetType: ReportTargetType;
}

export interface InstanceSettingsContract {
  bootstrapAdminConfigured?: boolean;
  id: number;
  registrationMode: "closed" | "invite_only" | "open";
  secretsManagedExternally?: boolean;
  settings: Record<string, unknown>;
  singlePlaceMode: boolean;
  updatedAt: string;
}