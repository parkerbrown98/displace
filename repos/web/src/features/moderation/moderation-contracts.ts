import type { components } from '@displace/api-client';
import {
  ACTION_REASON_CODES,
  REPORT_REASON_CODES,
} from '@displace/api-client/domain-values';

export type ReportReasonCode = components['schemas']['CreateReportDto']['reasonCode'];
export type ActionReasonCode = components['schemas']['CreateModerationActionDto']['reasonCode'];
export type ReportTargetType = components['schemas']['CreateReportDto']['targetType'];
export type ReportStatus = components['schemas']['ModerationReportDto']['status'];
export type ModerationActionName = components['schemas']['CreateModerationActionDto']['action'];

export const reportReasonCodes = REPORT_REASON_CODES;

export const actionReasonCodes = ACTION_REASON_CODES;

export type ModerationNoteContract = components['schemas']['ModeratorNoteDto'];
export type ModerationActionContract = components['schemas']['ModerationActionRecordDto'];
export type ModerationReportContract = components['schemas']['ModerationReportDto'] &
  Partial<Pick<components['schemas']['ModerationReportDetailDto'], 'actions' | 'notes'>>;
export type ModerationReportPageContract = Omit<components['schemas']['ModerationReportPageDto'], 'items'> & {
  items: ModerationReportContract[];
};
export type ModerationActionInput = components['schemas']['CreateModerationActionDto'];
export type InstanceSettingsContract = components['schemas']['InstanceSettingsDto'];