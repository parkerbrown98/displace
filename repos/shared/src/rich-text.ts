export type RichTextMarkType = 'bold' | 'code' | 'italic' | 'link' | 'strike';

export interface RichTextMark {
  attrs?: { href?: string };
  type: RichTextMarkType;
}

export type RichTextNodeType =
  | 'blockquote'
  | 'bulletList'
  | 'codeBlock'
  | 'doc'
  | 'hardBreak'
  | 'heading'
  | 'image'
  | 'listItem'
  | 'mention'
  | 'orderedList'
  | 'paragraph'
  | 'text';

export interface RichTextNode {
  attrs?: {
    alt?: string;
    assetId?: string;
    handle?: string;
    href?: string;
    level?: 1 | 2 | 3;
  };
  content?: RichTextNode[];
  marks?: RichTextMark[];
  text?: string;
  type: RichTextNodeType;
  version?: 1;
}

export interface RichTextDocument extends RichTextNode {
  content: RichTextNode[];
  type: 'doc';
  version: 1;
}

export const RICH_TEXT_LIMITS = {
  imageAltLength: 500,
  maxDepth: 32,
  textLength: 50_000,
} as const;

const BLOCK_CHILDREN = new Set<RichTextNodeType>([
  'blockquote',
  'bulletList',
  'codeBlock',
  'heading',
  'image',
  'orderedList',
  'paragraph',
]);
const INLINE_CHILDREN = new Set<RichTextNodeType>([
  'hardBreak',
  'mention',
  'text',
]);
const LIST_CHILDREN = new Set<RichTextNodeType>(['listItem']);
const CODE_CHILDREN = new Set<RichTextNodeType>(['text']);
const MARK_TYPES = new Set<RichTextMarkType>([
  'bold',
  'code',
  'italic',
  'link',
  'strike',
]);
const HANDLE_PATTERN = /^[a-z0-9_]{3,32}$/;
const UUID_V7_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-7[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export function isRichTextDocument(value: unknown): value is RichTextDocument {
  const text: string[] = [];
  if (!validateNode(value, undefined, 0, text)) return false;
  const length = text.join('').trim().length;
  return length > 0 && length <= RICH_TEXT_LIMITS.textLength;
}

function validateNode(
  value: unknown,
  parentType: RichTextNodeType | undefined,
  depth: number,
  text: string[],
): boolean {
  if (!isRecord(value) || depth > RICH_TEXT_LIMITS.maxDepth) return false;
  if (typeof value.type !== 'string' || !isNodeType(value.type)) return false;

  if (parentType === undefined) {
    return value.type === 'doc' && value.version === 1 &&
      hasOnlyKeys(value, ['content', 'type', 'version']) &&
      validateChildren(value, BLOCK_CHILDREN, depth, text, true);
  }

  const allowed = allowedChildren(parentType);
  if (!allowed?.has(value.type)) return false;

  switch (value.type) {
    case 'text':
      if (!hasOnlyKeys(value, ['marks', 'text', 'type']) || typeof value.text !== 'string') return false;
      if (!validateMarks(value.marks, parentType === 'codeBlock')) return false;
      text.push(value.text);
      return true;
    case 'hardBreak':
      text.push('\n');
      return hasOnlyKeys(value, ['type']);
    case 'mention': {
      if (!hasOnlyKeys(value, ['attrs', 'type']) || !isRecord(value.attrs) || !hasOnlyKeys(value.attrs, ['handle'])) return false;
      const handle = value.attrs.handle;
      if (typeof handle !== 'string' || !HANDLE_PATTERN.test(handle.toLowerCase())) return false;
      text.push(`@${handle}`);
      return true;
    }
    case 'image': {
      if (!hasOnlyKeys(value, ['attrs', 'type']) || !isRecord(value.attrs) || !hasOnlyKeys(value.attrs, ['alt', 'assetId'])) return false;
      const { alt, assetId } = value.attrs;
      if (typeof alt !== 'string' || alt.length > RICH_TEXT_LIMITS.imageAltLength || typeof assetId !== 'string' || !UUID_V7_PATTERN.test(assetId)) return false;
      text.push(alt);
      return true;
    }
    case 'heading':
      return hasOnlyKeys(value, ['attrs', 'content', 'type']) &&
        isRecord(value.attrs) &&
        hasOnlyKeys(value.attrs, ['level']) &&
        (value.attrs.level === 1 || value.attrs.level === 2 || value.attrs.level === 3) &&
        validateChildren(value, INLINE_CHILDREN, depth, text);
    case 'paragraph':
    case 'codeBlock':
      return hasOnlyKeys(value, ['content', 'type']) &&
        validateChildren(value, value.type === 'codeBlock' ? CODE_CHILDREN : INLINE_CHILDREN, depth, text);
    case 'blockquote':
    case 'bulletList':
    case 'orderedList':
      return hasOnlyKeys(value, ['content', 'type']) &&
        validateChildren(value, value.type === 'blockquote' ? BLOCK_CHILDREN : LIST_CHILDREN, depth, text, true);
    case 'listItem':
      return hasOnlyKeys(value, ['content', 'type']) &&
        validateChildren(value, BLOCK_CHILDREN, depth, text, true) &&
        Array.isArray(value.content) && value.content[0]?.type === 'paragraph';
    default:
      return false;
  }
}

function validateChildren(
  node: Record<string, unknown>,
  allowed: ReadonlySet<RichTextNodeType>,
  depth: number,
  text: string[],
  requireContent = false,
): boolean {
  if (!Array.isArray(node.content) || (requireContent && node.content.length === 0)) return false;
  return node.content.every((child) => {
    return isRecord(child) &&
      typeof child.type === 'string' &&
      isNodeType(child.type) &&
      allowed.has(child.type) &&
      validateNode(child, node.type as RichTextNodeType, depth + 1, text);
  });
}

function validateMarks(value: unknown, codeBlock: boolean): boolean {
  if (value === undefined) return true;
  if (!Array.isArray(value) || codeBlock) return false;
  const seen = new Set<RichTextMarkType>();
  return value.every((mark) => {
    if (!isRecord(mark) || typeof mark.type !== 'string' || !isMarkType(mark.type) || seen.has(mark.type)) return false;
    seen.add(mark.type);
    if (mark.type !== 'link') return hasOnlyKeys(mark, ['type']);
    return hasOnlyKeys(mark, ['attrs', 'type']) &&
      isRecord(mark.attrs) &&
      hasOnlyKeys(mark.attrs, ['href']) &&
      typeof mark.attrs.href === 'string' &&
      isSafeLink(mark.attrs.href);
  });
}

function allowedChildren(type: RichTextNodeType): ReadonlySet<RichTextNodeType> | undefined {
  if (type === 'doc' || type === 'blockquote' || type === 'listItem') return BLOCK_CHILDREN;
  if (type === 'paragraph' || type === 'heading') return INLINE_CHILDREN;
  if (type === 'bulletList' || type === 'orderedList') return LIST_CHILDREN;
  if (type === 'codeBlock') return CODE_CHILDREN;
  return undefined;
}

function isSafeLink(value: string): boolean {
  if (value.startsWith('/')) return true;
  try {
    return ['http:', 'https:', 'mailto:'].includes(new URL(value).protocol);
  } catch {
    return false;
  }
}

function isNodeType(value: string): value is RichTextNodeType {
  return value === 'doc' || BLOCK_CHILDREN.has(value as RichTextNodeType) || INLINE_CHILDREN.has(value as RichTextNodeType) || LIST_CHILDREN.has(value as RichTextNodeType);
}

function isMarkType(value: string): value is RichTextMarkType {
  return MARK_TYPES.has(value as RichTextMarkType);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function hasOnlyKeys(value: Record<string, unknown>, allowed: readonly string[]): boolean {
  return Object.keys(value).every((key) => allowed.includes(key));
}