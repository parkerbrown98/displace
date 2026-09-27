import type { components } from '@displace/api-client';

export type ReportReasonCode = components['schemas']['CreateReportDto']['reasonCode'];
export type ActionReasonCode = components['schemas']['CreateModerationActionDto']['reasonCode'];
export type ReportTargetType = components['schemas']['CreateReportDto']['targetType'];
export type ReportStatus = components['schemas']['ModerationReportDto']['status'];
export type ModerationActionName = components['schemas']['CreateModerationActionDto']['action'];

export const reportReasonCodes = [
  "spam",
  "harassment",
  "hate",
  "dangerous",
  "sexual",
  "privacy",
  "impersonation",
  "other",
] as const satisfies readonly ReportReasonCode[];

export const actionReasonCodes = [
  "policy_violation",
  "spam",
  "harassment",
  "hate",
  "safety",
  "ban_evasion",
  "other",
] as const satisfies readonly ActionReasonCode[];

export type ModerationNoteContract = components['schemas']['ModeratorNoteDto'];
export type ModerationActionContract = components['schemas']['ModerationActionRecordDto'];
export type ModerationReportContract = components['schemas']['ModerationReportDto'] &
  Partial<Pick<components['schemas']['ModerationReportDetailDto'], 'actions' | 'notes'>>;
export type ModerationReportPageContract = Omit<components['schemas']['ModerationReportPageDto'], 'items'> & {
  items: ModerationReportContract[];
};
export type ModerationActionInput = components['schemas']['CreateModerationActionDto'];
export type InstanceSettingsContract = components['schemas']['InstanceSettingsDto'];