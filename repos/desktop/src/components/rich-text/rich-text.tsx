import { Fragment, type ReactNode } from 'react';
import { ImageOff } from 'lucide-react';
import type { RichTextDocument, RichTextMark, RichTextNode } from '@displace/api-client';
import { isRichTextDocument } from '@displace/api-client/rich-text';

export function RichText({ value }: { value: unknown }) {
  if (!isRichTextDocument(value)) return null;
  return <div className="rich-text">{renderNodes(value.content)}</div>;
}

function renderNodes(nodes: RichTextNode[] | undefined): ReactNode {
  return nodes?.map((node, index) => <Fragment key={`${node.type}-${index}`}>{renderNode(node)}</Fragment>);
}

function renderNode(node: RichTextNode): ReactNode {
  const content = renderNodes(node.content);
  switch (node.type) {
    case 'doc': return renderNodes((node as RichTextDocument).content);
    case 'paragraph': return <p>{content}</p>;
    case 'blockquote': return <blockquote>{content}</blockquote>;
    case 'bulletList': return <ul>{content}</ul>;
    case 'orderedList': return <ol>{content}</ol>;
    case 'listItem': return <li>{content}</li>;
    case 'hardBreak': return <br />;
    case 'heading': {
      if (node.attrs?.level === 1) return <h1>{content}</h1>;
      if (node.attrs?.level === 2) return <h2>{content}</h2>;
      return <h3>{content}</h3>;
    }
    case 'codeBlock': return <pre><code>{content}</code></pre>;
    case 'mention': return <span className="mention">@{node.attrs?.handle ?? 'member'}</span>;
    case 'image': return <span className="rich-asset"><ImageOff aria-hidden="true" size={16} />{node.attrs?.alt || 'Attached image'}</span>;
    case 'text': return applyMarks(node.text ?? '', node.marks);
  }
}

function applyMarks(text: ReactNode, marks: RichTextMark[] | undefined): ReactNode {
  return marks?.reduce<ReactNode>((content, mark, index) => {
    if (mark.type === 'bold') return <strong key={index}>{content}</strong>;
    if (mark.type === 'italic') return <em key={index}>{content}</em>;
    if (mark.type === 'strike') return <s key={index}>{content}</s>;
    if (mark.type === 'code') return <code key={index}>{content}</code>;
    if (mark.type === 'link') {
      const href = safeHref(mark.attrs?.href);
      return href ? <a href={href} key={index} rel="nofollow noopener noreferrer" target="_blank">{content}</a> : content;
    }
    return content;
  }, text) ?? text;
}

function safeHref(value: unknown): string | undefined {
  if (typeof value !== 'string') return undefined;
  try {
    const url = new URL(value);
    return url.protocol === 'https:' || url.protocol === 'http:' ? value : undefined;
  } catch {
    return undefined;
  }
}