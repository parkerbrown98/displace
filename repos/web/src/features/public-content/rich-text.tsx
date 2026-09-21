import { Fragment, type ReactNode } from "react";
import type { RichTextDocumentContract, RichTextMarkContract, RichTextNodeContract } from "./public-contracts";

export function RichText({ document }: { document: RichTextDocumentContract }) {
  return <div className="rich-text">{renderNodes(document.content)}</div>;
}

function renderNodes(nodes: RichTextNodeContract[] | undefined): ReactNode {
  return nodes?.map((node, index) => (
    <Fragment key={`${node.type}-${index}`}>{renderNode(node)}</Fragment>
  ));
}

function renderNode(node: RichTextNodeContract): ReactNode {
  const content = renderNodes(node.content);
  switch (node.type) {
    case "doc": return content;
    case "paragraph": return <p>{content}</p>;
    case "blockquote": return <blockquote>{content}</blockquote>;
    case "bulletList": return <ul>{content}</ul>;
    case "orderedList": return <ol>{content}</ol>;
    case "listItem": return <li>{content}</li>;
    case "hardBreak": return <br />;
    case "heading": {
      const level = node.attrs?.level;
      if (level === 1) return <h1>{content}</h1>;
      if (level === 2) return <h2>{content}</h2>;
      if (level === 3) return <h3>{content}</h3>;
      return null;
    }
    case "codeBlock": return <pre><code>{content}</code></pre>;
    case "mention": {
      const handle = typeof node.attrs?.handle === "string" ? node.attrs.handle : "member";
      return <span className="mention">@{handle}</span>;
    }
    case "text": return applyMarks(node.text ?? "", node.marks);
    default: return null;
  }
}

function applyMarks(text: ReactNode, marks: RichTextMarkContract[] | undefined): ReactNode {
  return marks?.reduce<ReactNode>((content, mark, index) => {
    switch (mark.type) {
      case "bold": return <strong key={index}>{content}</strong>;
      case "italic": return <em key={index}>{content}</em>;
      case "strike": return <s key={index}>{content}</s>;
      case "code": return <code key={index}>{content}</code>;
      case "link": {
        const href = safeHref(mark.attrs?.href);
        return href ? <a href={href} key={index} rel="nofollow noopener noreferrer">{content}</a> : content;
      }
      default: return content;
    }
  }, text) ?? text;
}

function safeHref(value: unknown): string | undefined {
  if (typeof value !== "string") return undefined;
  if (value.startsWith("/")) return value;
  try {
    const url = new URL(value);
    return url.protocol === "https:" || url.protocol === "http:" ? value : undefined;
  } catch {
    return undefined;
  }
}