import { BadRequestException } from '@nestjs/common';
import { RichTextService } from './rich-text.service.js';

describe('RichTextService', () => {
  const service = new RichTextService();

  it('derives safe HTML, plain text, and normalized mentions', () => {
    expect(
      service.render({
        type: 'doc',
        version: 1,
        content: [
          {
            type: 'paragraph',
            content: [
              { marks: [{ type: 'bold' }], text: '<hello>', type: 'text' },
              { text: ' ', type: 'text' },
              { attrs: { handle: 'Parker_1' }, type: 'mention' },
              {
                marks: [
                  { attrs: { href: 'https://example.test/a b' }, type: 'link' },
                ],
                text: ' link',
                type: 'text',
              },
            ],
          },
        ],
      }),
    ).toEqual({
      document: expect.any(Object),
      html: '<p><strong>&lt;hello&gt;</strong> <span data-mention="parker_1">@parker_1</span><a href="https://example.test/a%20b" rel="nofollow noreferrer"> link</a></p>',
      mentions: ['parker_1'],
      text: '<hello> @parker_1 link',
    });
  });

  it.each([
    { content: [], type: 'doc', version: 1 },
    {
      content: [{ content: [{ text: 'bad', type: 'script' }], type: 'paragraph' }],
      type: 'doc',
      version: 1,
    },
    {
      content: [
        {
          content: [
            {
              marks: [{ attrs: { href: 'javascript:alert(1)' }, type: 'link' }],
              text: 'bad',
              type: 'text',
            },
          ],
          type: 'paragraph',
        },
      ],
      type: 'doc',
      version: 1,
    },
    {
      content: [{ content: [{ text: 'not a list item', type: 'text' }], type: 'bulletList' }],
      type: 'doc',
      version: 1,
    },
    {
      content: [{ attrs: { onclick: 'bad' }, content: [{ text: 'bad', type: 'text' }], type: 'paragraph' }],
      type: 'doc',
      version: 1,
    },
    {
      content: [{ content: [{ marks: [{ attrs: { extra: true }, type: 'bold' }], text: 'bad', type: 'text' }], type: 'paragraph' }],
      type: 'doc',
      version: 1,
    },
  ])('rejects unsupported or empty documents', (document) => {
    expect(() => service.render(document)).toThrow(BadRequestException);
  });
});