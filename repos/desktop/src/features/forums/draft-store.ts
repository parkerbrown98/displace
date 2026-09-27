import type { RichTextDocument } from '../places/place-client';

export interface ForumDraft {
  document?: RichTextDocument;
  forumId?: string;
  tagIds?: string[];
  title?: string;
  updatedAt: string;
}

const PREFIX = 'displace:forum-draft:';

export function forumDraftKey(userId: string, placeId: string, target: string): string {
  return `${PREFIX}${userId}:${placeId}:${target}`;
}

export function loadForumDraft(key: string): ForumDraft | undefined {
  try {
    const value = JSON.parse(localStorage.getItem(key) ?? 'null') as unknown;
    if (!value || typeof value !== 'object' || !('updatedAt' in value) || typeof value.updatedAt !== 'string') return undefined;
    return value as ForumDraft;
  } catch {
    return undefined;
  }
}

export function saveForumDraft(key: string, draft: Omit<ForumDraft, 'updatedAt'>): void {
  localStorage.setItem(key, JSON.stringify({ ...draft, updatedAt: new Date().toISOString() } satisfies ForumDraft));
}

export function removeForumDraft(key: string): void {
  localStorage.removeItem(key);
}