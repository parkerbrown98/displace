import { describe, expect, it } from 'vitest';
import { toForumDocument } from './forum-editor';

describe('toForumDocument', () => {
  it('keeps only supported nodes, marks, and attributes', () => {
    expect(toForumDocument({
      type: 'doc',
      content: [
        { type: 'heading', attrs: { level: 9, class: 'unsafe' }, content: [{ type: 'text', text: 'Hello', marks: [{ type: 'bold' }, { type: 'highlight' }] }] },
        { type: 'mention', attrs: { handle: 'PARKER', userId: 'do-not-store' } },
        { type: 'image', attrs: { assetId: 'asset-1', alt: 'Image', src: 'C:\\private\\image.png' } },
        { type: 'script', attrs: { src: 'https://example.test/script.js' } },
      ],
    })).toEqual({
      type: 'doc', version: 1, content: [
        { type: 'heading', attrs: { level: 2 }, content: [{ type: 'text', text: 'Hello', marks: [{ type: 'bold' }] }] },
        { type: 'mention', attrs: { handle: 'parker' } },
        { type: 'image', attrs: { assetId: 'asset-1', alt: 'Image' } },
      ],
    });
  });

  it('truncates image alt text and strips invalid links', () => {
    const document = toForumDocument({ type: 'doc', content: [{ type: 'paragraph', content: [
      { type: 'text', text: 'linked', marks: [{ type: 'link', attrs: { href: 42, target: '_blank' } }] },
      { type: 'image', attrs: { assetId: 'asset-2', alt: 'x'.repeat(600) } },
    ] }] });
    expect(document).toEqual({ type: 'doc', version: 1, content: [{ type: 'paragraph', content: [
      { type: 'text', text: 'linked' },
      { type: 'image', attrs: { assetId: 'asset-2', alt: 'x'.repeat(500) } },
    ] }] });
  });
});