import { BadRequestException, Injectable } from '@nestjs/common';
import type {
  RichTextDocument,
  RichTextNode,
} from '../database/schema/forums.js';

export interface RenderedRichText {
  assetIds: string[];
  document: RichTextDocument;
  html: string;
  mentions: string[];
  text: string;
}

const CONTAINER_NODES = new Set([
  'blockquote',
  'bulletList',
  'doc',
  'listItem',
  'orderedList',
]);
const BLOCK_NODES = new Set(['codeBlock', 'heading', 'paragraph']);
const MARKS = new Set(['bold', 'code', 'italic', 'link', 'strike']);
const HANDLE_PATTERN = /^[a-z0-9_]{3,32}$/;
const BLOCK_CHILDREN = new Set([
  'blockquote',
  'bulletList',
  'codeBlock',
  'heading',
  'image',
  'orderedList',
  'paragraph',
]);
const INLINE_CHILDREN = new Set(['hardBreak', 'mention', 'text']);
const LIST_CHILDREN = new Set(['listItem']);
const LIST_ITEM_CHILDREN = new Set(BLOCK_CHILDREN);
const CODE_CHILDREN = new Set(['text']);
const UUID_V7_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-7[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

@Injectable()
export class RichTextService {
  render(value: unknown): RenderedRichText {
    if (!this.isRecord(value) || value.type !== 'doc' || value.version !== 1) {
      throw this.invalid();
    }
    const document = value as RichTextDocument;
    if (!Array.isArray(document.content) || document.content.length === 0) {
      throw this.invalid();
    }
    this.validateNode(document, undefined, 0);
    const assetIds = new Set<string>();
    const mentions = new Set<string>();
    const rendered = this.renderNode(document, mentions, assetIds, 0);
    const text = rendered.text.trim();
    if (text.length === 0 || text.length > 50_000) {
      throw new BadRequestException(
        'Rich-text content must contain between 1 and 50000 characters.',
      );
    }
    return {
      assetIds: [...assetIds],
      document,
      html: rendered.html,
      mentions: [...mentions],
      text,
    };
  }

  private validateNode(
    node: unknown,
    parentType: string | undefined,
    depth: number,
  ): void {
    if (!this.isRecord(node) || typeof node.type !== 'string' || depth > 32) {
      throw this.invalid();
    }
    if (parentType === undefined) {
      if (node.type !== 'doc' || node.version !== 1) throw this.invalid();
      this.requireKeys(node, ['content', 'type', 'version']);
      this.validateChildren(node, BLOCK_CHILDREN, depth);
      return;
    }

    const allowed = this.allowedChildren(parentType);
    if (!allowed.has(node.type)) throw this.invalid();
    switch (node.type) {
      case 'text':
        this.requireKeys(node, ['marks', 'text', 'type']);
        if (typeof node.text !== 'string') throw this.invalid();
        this.validateMarks(node.marks, parentType === 'codeBlock');
        return;
      case 'hardBreak':
        this.requireKeys(node, ['type']);
        return;
      case 'mention': {
        this.requireKeys(node, ['attrs', 'type']);
        if (!this.isRecord(node.attrs)) throw this.invalid();
        this.requireKeys(node.attrs, ['handle']);
        const handle = node.attrs.handle;
        if (
          typeof handle !== 'string' ||
          !HANDLE_PATTERN.test(handle.toLowerCase())
        ) {
          throw this.invalid();
        }
        return;
      }
      case 'image': {
        this.requireKeys(node, ['attrs', 'type']);
        if (!this.isRecord(node.attrs)) throw this.invalid();
        this.requireKeys(node.attrs, ['alt', 'assetId']);
        const assetId = node.attrs.assetId;
        const alt = node.attrs.alt;
        if (
          typeof assetId !== 'string' ||
          !UUID_V7_PATTERN.test(assetId) ||
          typeof alt !== 'string' ||
          alt.length > 500
        ) {
          throw this.invalid();
        }
        return;
      }
      case 'heading':
        this.requireKeys(node, ['attrs', 'content', 'type']);
        if (!this.isRecord(node.attrs)) throw this.invalid();
        this.requireKeys(node.attrs, ['level']);
        if (![1, 2, 3].includes(node.attrs.level as number))
          throw this.invalid();
        this.validateChildren(node, INLINE_CHILDREN, depth);
        return;
      case 'paragraph':
        this.requireKeys(node, ['content', 'type']);
        this.validateChildren(node, INLINE_CHILDREN, depth);
        return;
      case 'codeBlock':
        this.requireKeys(node, ['content', 'type']);
        this.validateChildren(node, CODE_CHILDREN, depth);
        return;
      case 'blockquote':
        this.requireKeys(node, ['content', 'type']);
        this.validateChildren(node, BLOCK_CHILDREN, depth, true);
        return;
      case 'bulletList':
      case 'orderedList':
        this.requireKeys(node, ['content', 'type']);
        this.validateChildren(node, LIST_CHILDREN, depth, true);
        return;
      case 'listItem':
        this.requireKeys(node, ['content', 'type']);
        this.validateChildren(node, LIST_ITEM_CHILDREN, depth, true);
        if (
          !Array.isArray(node.content) ||
          node.content[0]?.type !== 'paragraph'
        ) {
          throw this.invalid();
        }
        return;
      default:
        throw this.invalid();
    }
  }

  private validateChildren(
    node: Record<string, unknown>,
    allowed: ReadonlySet<string>,
    depth: number,
    requireContent = false,
  ): void {
    if (
      !Array.isArray(node.content) ||
      (requireContent && node.content.length === 0)
    ) {
      throw this.invalid();
    }
    for (const child of node.content) {
      if (
        !this.isRecord(child) ||
        typeof child.type !== 'string' ||
        !allowed.has(child.type)
      ) {
        throw this.invalid();
      }
      this.validateNode(child, node.type as string, depth + 1);
    }
  }

  private validateMarks(value: unknown, codeBlock: boolean): void {
    if (value === undefined) return;
    if (!Array.isArray(value) || codeBlock) throw this.invalid();
    const seen = new Set<string>();
    for (const mark of value) {
      if (
        !this.isRecord(mark) ||
        typeof mark.type !== 'string' ||
        !MARKS.has(mark.type) ||
        seen.has(mark.type)
      ) {
        throw this.invalid();
      }
      seen.add(mark.type);
      this.requireKeys(
        mark,
        mark.type === 'link' ? ['attrs', 'type'] : ['type'],
      );
      if (mark.type === 'link') {
        if (!this.isRecord(mark.attrs)) throw this.invalid();
        this.requireKeys(mark.attrs, ['href']);
        this.normalizeLink(this.stringAttribute(mark, 'href'));
      }
    }
  }

  private allowedChildren(parentType: string): ReadonlySet<string> {
    switch (parentType) {
      case 'doc':
      case 'blockquote':
        return BLOCK_CHILDREN;
      case 'paragraph':
      case 'heading':
        return INLINE_CHILDREN;
      case 'bulletList':
      case 'orderedList':
        return LIST_CHILDREN;
      case 'listItem':
        return LIST_ITEM_CHILDREN;
      case 'codeBlock':
        return CODE_CHILDREN;
      default:
        throw this.invalid();
    }
  }

  private requireKeys(
    value: Record<string, unknown>,
    allowed: readonly string[],
  ): void {
    if (Object.keys(value).some((key) => !allowed.includes(key))) {
      throw this.invalid();
    }
  }

  private renderNode(
    node: RichTextNode,
    mentions: Set<string>,
    assetIds: Set<string>,
    depth: number,
  ): { html: string; text: string } {
    if (!this.isRecord(node) || typeof node.type !== 'string' || depth > 32) {
      throw this.invalid();
    }
    if (node.type === 'text') {
      return this.renderText(node);
    }
    if (node.type === 'hardBreak') {
      this.requireLeaf(node);
      return { html: '<br>', text: '\n' };
    }
    if (node.type === 'mention') {
      this.requireLeaf(node);
      const handle = this.stringAttribute(node, 'handle').toLowerCase();
      if (!HANDLE_PATTERN.test(handle)) {
        throw this.invalid();
      }
      mentions.add(handle);
      return {
        html: `<span data-mention="${this.escape(handle)}">@${this.escape(handle)}</span>`,
        text: `@${handle}`,
      };
    }
    if (node.type === 'image') {
      this.requireLeaf(node);
      const assetId = this.stringAttribute(node, 'assetId');
      const alt = this.stringAttribute(node, 'alt');
      if (!UUID_V7_PATTERN.test(assetId) || alt.length > 500) {
        throw this.invalid();
      }
      assetIds.add(assetId);
      return {
        html: `<img data-asset-id="${assetId}" alt="${this.escape(alt)}">`,
        text: alt,
      };
    }
    if (!CONTAINER_NODES.has(node.type) && !BLOCK_NODES.has(node.type)) {
      throw this.invalid();
    }
    if (!Array.isArray(node.content)) {
      throw this.invalid();
    }
    const children = node.content.map((child) =>
      this.renderNode(child, mentions, assetIds, depth + 1),
    );
    const html = children.map((child) => child.html).join('');
    const text = children.map((child) => child.text).join('');
    switch (node.type) {
      case 'doc':
        return { html, text };
      case 'paragraph':
        return { html: `<p>${html}</p>`, text: `${text}\n` };
      case 'heading': {
        const level = node.attrs?.level;
        if (level !== 1 && level !== 2 && level !== 3) {
          throw this.invalid();
        }
        return { html: `<h${level}>${html}</h${level}>`, text: `${text}\n` };
      }
      case 'blockquote':
        return { html: `<blockquote>${html}</blockquote>`, text: `${text}\n` };
      case 'bulletList':
        return { html: `<ul>${html}</ul>`, text: `${text}\n` };
      case 'orderedList':
        return { html: `<ol>${html}</ol>`, text: `${text}\n` };
      case 'listItem':
        return { html: `<li>${html}</li>`, text: `${text}\n` };
      case 'codeBlock':
        return {
          html: `<pre><code>${html}</code></pre>`,
          text: `${text}\n`,
        };
      default:
        throw this.invalid();
    }
  }

  private renderText(node: RichTextNode): { html: string; text: string } {
    if (typeof node.text !== 'string' || node.content !== undefined) {
      throw this.invalid();
    }
    let html = this.escape(node.text);
    for (const mark of node.marks ?? []) {
      if (
        !this.isRecord(mark) ||
        typeof mark.type !== 'string' ||
        !MARKS.has(mark.type)
      ) {
        throw this.invalid();
      }
      switch (mark.type) {
        case 'bold':
          html = `<strong>${html}</strong>`;
          break;
        case 'italic':
          html = `<em>${html}</em>`;
          break;
        case 'strike':
          html = `<s>${html}</s>`;
          break;
        case 'code':
          html = `<code>${html}</code>`;
          break;
        case 'link': {
          const href = this.normalizeLink(this.stringAttribute(mark, 'href'));
          html = `<a href="${this.escape(href)}" rel="nofollow noreferrer">${html}</a>`;
          break;
        }
      }
    }
    return { html, text: node.text };
  }

  private normalizeLink(value: string): string {
    if (value.startsWith('/')) {
      return value.replaceAll(/\s/g, '%20');
    }
    let url: URL;
    try {
      url = new URL(value);
    } catch {
      throw new BadRequestException('Rich-text links must be valid URLs.');
    }
    if (!['http:', 'https:', 'mailto:'].includes(url.protocol)) {
      throw new BadRequestException('Rich-text link protocol is not allowed.');
    }
    return url.toString();
  }

  private requireLeaf(node: RichTextNode): void {
    if (
      node.content !== undefined ||
      node.text !== undefined ||
      node.marks !== undefined
    ) {
      throw this.invalid();
    }
  }

  private stringAttribute(
    value: { attrs?: Record<string, unknown> },
    name: string,
  ): string {
    const attribute = value.attrs?.[name];
    if (typeof attribute !== 'string') {
      throw this.invalid();
    }
    return attribute;
  }

  private escape(value: string): string {
    return value
      .replaceAll('&', '&amp;')
      .replaceAll('<', '&lt;')
      .replaceAll('>', '&gt;')
      .replaceAll('"', '&quot;')
      .replaceAll("'", '&#39;');
  }

  private isRecord(value: unknown): value is Record<string, unknown> {
    return typeof value === 'object' && value !== null && !Array.isArray(value);
  }

  private invalid(): BadRequestException {
    return new BadRequestException('Rich-text document is invalid.');
  }
}
