import { describe, expect, it } from 'vitest';
import { isRichTextDocument } from './rich-text.js';

const document = {
  content: [
    {
      content: [
        { marks: [{ type: 'bold' }], text: 'Hello ', type: 'text' },
        { attrs: { handle: 'member' }, type: 'mention' },
      ],
      type: 'paragraph',
    },
  ],
  type: 'doc',
  version: 1,
};

describe('isRichTextDocument', () => {
  it('accepts the supported document grammar', () => {
    expect(isRichTextDocument(document)).toBe(true);
  });

  it('rejects unknown nodes and unsafe links', () => {
    expect(isRichTextDocument({ ...document, content: [{ type: 'script' }] })).toBe(false);
    expect(isRichTextDocument({
      ...document,
      content: [{
        content: [{ marks: [{ attrs: { href: 'javascript:alert(1)' }, type: 'link' }], text: 'Bad', type: 'text' }],
        type: 'paragraph',
      }],
    })).toBe(false);
  });

  it('rejects empty and oversized documents', () => {
    expect(isRichTextDocument({ ...document, content: [] })).toBe(false);
    expect(isRichTextDocument({
      ...document,
      content: [{ content: [{ text: 'a'.repeat(50_001), type: 'text' }], type: 'paragraph' }],
    })).toBe(false);
  });
});