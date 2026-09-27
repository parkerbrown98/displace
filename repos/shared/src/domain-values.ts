import type { components, operations } from './schema.js';

type Equal<Left, Right> =
  (<Value>() => Value extends Left ? 1 : 2) extends
  (<Value>() => Value extends Right ? 1 : 2)
    ? true
    : false;
type Assert<Value extends true> = Value;

export type PlacePermission =
  components['schemas']['PlaceViewerDto']['permissions'][number];

export const PLACE_PERMISSIONS = [
  'place.manage',
  'role.manage',
  'member.manage',
  'forum.manage',
  'topic.create',
  'post.create',
  'chat.manage',
  'chat.send',
  'voice.manage',
  'voice.join',
  'upload.read',
  'upload.create',
  'moderation.manage',
] as const satisfies readonly PlacePermission[];

type _PlacePermissionsAreExhaustive = Assert<
  Equal<PlacePermission, (typeof PLACE_PERMISSIONS)[number]>
>;

export type ReportReasonCode =
  components['schemas']['CreateReportDto']['reasonCode'];

export const REPORT_REASON_CODES = [
  'spam',
  'harassment',
  'hate',
  'dangerous',
  'sexual',
  'privacy',
  'impersonation',
  'other',
] as const satisfies readonly ReportReasonCode[];

type _ReportReasonCodesAreExhaustive = Assert<
  Equal<ReportReasonCode, (typeof REPORT_REASON_CODES)[number]>
>;

export type ActionReasonCode =
  components['schemas']['CreateModerationActionDto']['reasonCode'];

export const ACTION_REASON_CODES = [
  'policy_violation',
  'spam',
  'harassment',
  'hate',
  'safety',
  'ban_evasion',
  'other',
] as const satisfies readonly ActionReasonCode[];

type _ActionReasonCodesAreExhaustive = Assert<
  Equal<ActionReasonCode, (typeof ACTION_REASON_CODES)[number]>
>;

export type ApiTokenScope =
  components['schemas']['ApiTokenDto']['scopes'][number];

export const API_TOKEN_SCOPES = [
  'read',
  'write',
  'moderation',
  'administration',
] as const satisfies readonly ApiTokenScope[];

type _ApiTokenScopesAreExhaustive = Assert<
  Equal<ApiTokenScope, (typeof API_TOKEN_SCOPES)[number]>
>;

type FeedQuery = NonNullable<
  operations['FeedController_list_v1']['parameters']['query']
>;

export type HomeFeedSort = NonNullable<FeedQuery['sort']>;

export const HOME_FEED_SORTS = [
  'best',
  'hot',
  'new',
  'top',
] as const satisfies readonly HomeFeedSort[];

type _HomeFeedSortsAreExhaustive = Assert<
  Equal<HomeFeedSort, (typeof HOME_FEED_SORTS)[number]>
>;

type TopicQuery = NonNullable<
  operations['ForumsController_listTopics_v1']['parameters']['query']
>;

export type TopicFeed = NonNullable<TopicQuery['feed']>;

export const TOPIC_FEEDS = [
  'following',
  'latest',
  'popular',
] as const satisfies readonly TopicFeed[];

type _TopicFeedsAreExhaustive = Assert<
  Equal<TopicFeed, (typeof TOPIC_FEEDS)[number]>
>;