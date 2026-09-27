import { beforeEach, describe, expect, it, vi } from 'vitest';
import { forumDraftKey, loadForumDraft, removeForumDraft, saveForumDraft } from './draft-store';

describe('forum draft storage', () => {
  beforeEach(() => localStorage.clear());

  it('scopes, saves, restores, and removes sanitized draft data', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-02-24T12:00:00Z'));
    const key = forumDraftKey('user-1', 'place-1', 'reply:topic-1');
    const document = { type: 'doc' as const, version: 1 as const, content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Draft' }] }] };
    saveForumDraft(key, { document, forumId: 'forum-1', tagIds: ['tag-1'], title: 'Hello' });
    expect(key).toBe('displace:forum-draft:user-1:place-1:reply:topic-1');
    expect(loadForumDraft(key)).toEqual({ document, forumId: 'forum-1', tagIds: ['tag-1'], title: 'Hello', updatedAt: '2026-02-24T12:00:00.000Z' });
    removeForumDraft(key);
    expect(loadForumDraft(key)).toBeUndefined();
    vi.useRealTimers();
  });

  it('ignores malformed or unversioned values', () => {
    localStorage.setItem('bad-json', '{');
    localStorage.setItem('bad-shape', JSON.stringify({ title: 'No timestamp' }));
    expect(loadForumDraft('bad-json')).toBeUndefined();
    expect(loadForumDraft('bad-shape')).toBeUndefined();
  });
});