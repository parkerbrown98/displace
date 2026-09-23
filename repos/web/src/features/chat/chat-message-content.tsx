"use client";

import { ExternalLink } from "lucide-react";
import { useState } from "react";

const linkPattern = /https?:\/\/[^\s<]+/gi;
const trailingPunctuation = /[),.!?:;]+$/;
const imageExtensions = /\.(?:avif|gif|jpe?g|png|webp)$/i;

interface MessagePart {
  kind: "link" | "text";
  value: string;
}

export function ChatMessageContent({ body }: { body: string }) {
  const parts = messageParts(body);
  const links = [...new Set(parts.filter((part) => part.kind === "link").map((part) => part.value))];

  return <>
    <p className="chat-message-body">{parts.map((part, index) => part.kind === "link" ? <a href={part.value} key={`${part.value}-${index}`} rel="nofollow noopener noreferrer ugc" target="_blank">{part.value}</a> : part.value)}</p>
    {links.length ? <div className="chat-link-previews">{links.map((href) => <ChatLinkPreview href={href} key={href} />)}</div> : null}
  </>;
}

function ChatLinkPreview({ href }: { href: string }) {
  const [imageFailed, setImageFailed] = useState(false);
  const url = safeUrl(href);
  if (!url) return null;

  const directImage = imageExtensions.test(url.pathname);
  if (directImage && !imageFailed) return <a aria-label={`Open image from ${url.hostname}`} className="chat-image-preview" href={href} rel="nofollow noopener noreferrer ugc" target="_blank">
    {/* eslint-disable-next-line @next/next/no-img-element -- User-provided remote hosts cannot use the configured image optimizer. */}
    <img alt="" loading="lazy" onError={() => setImageFailed(true)} src={href} />
  </a>;

  return <a className="chat-link-card" href={href} rel="nofollow noopener noreferrer ugc" target="_blank">
    <span className="chat-link-card-mark" aria-hidden="true">{url.hostname.slice(0, 1).toUpperCase()}</span>
    <span><small>{url.hostname}</small><strong>{linkLabel(url)}</strong></span>
    <ExternalLink aria-hidden="true" size={15} />
  </a>;
}

function messageParts(body: string): MessagePart[] {
  const parts: MessagePart[] = [];
  let cursor = 0;
  for (const match of body.matchAll(linkPattern)) {
    const start = match.index;
    const matched = match[0];
    if (start > cursor) parts.push({ kind: "text", value: body.slice(cursor, start) });
    const value = trimLink(matched);
    parts.push({ kind: "link", value });
    if (value.length < matched.length) parts.push({ kind: "text", value: matched.slice(value.length) });
    cursor = start + matched.length;
  }
  if (cursor < body.length) parts.push({ kind: "text", value: body.slice(cursor) });
  return parts.length ? parts : [{ kind: "text", value: body }];
}

function trimLink(value: string) {
  return value.replace(trailingPunctuation, "");
}

function safeUrl(value: string) {
  try {
    const url = new URL(value);
    return url.protocol === "http:" || url.protocol === "https:" ? url : undefined;
  } catch {
    return undefined;
  }
}

function linkLabel(url: URL) {
  const path = decodeURIComponent(url.pathname).replace(/\/$/, "");
  return path && path !== "/" ? path.split("/").filter(Boolean).at(-1) ?? url.hostname : url.hostname;
}
