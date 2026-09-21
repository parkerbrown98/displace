"use client";

import { Node, type JSONContent } from "@tiptap/core";
import { EditorContent, useEditor } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import {
  AtSign,
  Bold,
  Code,
  Heading2,
  ImagePlus,
  Italic,
  List,
  ListOrdered,
  Quote,
  Redo2,
  Strikethrough,
  Undo2,
} from "lucide-react";
import { useDeferredValue, useEffect, useState } from "react";
import { ImageUploader } from "@/features/assets/image-uploader";
import { listPlaceMembers } from "@/features/places/place-client";
import type { PlaceMemberContract } from "@/features/places/place-contract";
import type { RichTextDocumentContract, RichTextMarkContract, RichTextNodeContract } from "./forum-contract";

const MentionNode = Node.create({
  name: "mention",
  group: "inline",
  inline: true,
  atom: true,
  addAttributes() {
    return { handle: { default: null } };
  },
  parseHTML() {
    return [{ tag: "span[data-mention]", getAttrs: (element) => ({ handle: (element as HTMLElement).dataset.mention }) }];
  },
  renderHTML({ node }) {
    return ["span", { "data-mention": node.attrs.handle, class: "editor-mention" }, `@${node.attrs.handle}`];
  },
  renderText({ node }) {
    return `@${node.attrs.handle}`;
  },
});

const AssetImageNode = Node.create({
  name: "image",
  group: "block",
  atom: true,
  addAttributes() {
    return { alt: { default: "" }, assetId: { default: null } };
  },
  parseHTML() {
    return [{
      tag: "figure[data-asset-id]",
      getAttrs: (element) => ({
        alt: (element as HTMLElement).dataset.alt ?? "",
        assetId: (element as HTMLElement).dataset.assetId,
      }),
    }];
  },
  renderHTML({ node }) {
    return ["figure", { "data-alt": node.attrs.alt, "data-asset-id": node.attrs.assetId, class: "editor-asset-image" }, ["span", {}, node.attrs.alt || "Uploaded image"]];
  },
});

const extensions = [
  StarterKit.configure({
    heading: { levels: [1, 2, 3] },
    horizontalRule: false,
  }),
  MentionNode,
  AssetImageNode,
];

interface ForumEditorProps {
  canUpload?: boolean;
  initialDocument?: RichTextDocumentContract;
  label: string;
  onChange: (document: RichTextDocumentContract, isEmpty: boolean) => void;
  placeId: string;
}

export function ForumEditor({ canUpload = false, initialDocument, label, onChange, placeId }: ForumEditorProps) {
  const [mentionOpen, setMentionOpen] = useState(false);
  const [imageOpen, setImageOpen] = useState(false);
  const [mentionQuery, setMentionQuery] = useState("");
  const [members, setMembers] = useState<PlaceMemberContract[]>([]);
  const deferredMentionQuery = useDeferredValue(mentionQuery.trim());
  const editor = useEditor({
    content: initialDocument ? { type: "doc", content: initialDocument.content } : undefined,
    editorProps: { attributes: { "aria-label": label, role: "textbox" } },
    extensions,
    immediatelyRender: false,
    onCreate: ({ editor: currentEditor }) => onChange(toForumDocument(currentEditor.getJSON()), currentEditor.isEmpty),
    onUpdate: ({ editor: currentEditor }) => onChange(toForumDocument(currentEditor.getJSON()), currentEditor.isEmpty),
  });

  useEffect(() => {
    if (!mentionOpen || deferredMentionQuery.length < 2) {
      return;
    }
    let active = true;
    const timeout = window.setTimeout(() => {
      void listPlaceMembers(placeId, "active", deferredMentionQuery).then((result) => {
        if (active) setMembers(result.items.slice(0, 8));
      }).catch(() => {
        if (active) setMembers([]);
      });
    }, 200);
    return () => {
      active = false;
      window.clearTimeout(timeout);
    };
  }, [deferredMentionQuery, mentionOpen, placeId]);

  const visibleMembers = deferredMentionQuery.length >= 2 ? members : [];

  function insertMention(handle: string) {
    editor?.chain().focus().insertContent([
      { type: "mention", attrs: { handle } },
      { type: "text", text: " " },
    ]).run();
    setMentionOpen(false);
    setMentionQuery("");
  }

  function insertImage(assetId: string, alt: string) {
    editor?.chain().focus().insertContent({ type: "image", attrs: { alt, assetId } }).run();
    setImageOpen(false);
  }

  return (
    <div className="forum-editor-field">
      <span className="forum-editor-label">{label}</span>
      <div className="forum-editor">
        <div className="forum-editor-toolbar" aria-label="Formatting tools" role="toolbar">
          <EditorButton active={editor?.isActive("bold")} label="Bold" onClick={() => editor?.chain().focus().toggleBold().run()}><Bold /></EditorButton>
          <EditorButton active={editor?.isActive("italic")} label="Italic" onClick={() => editor?.chain().focus().toggleItalic().run()}><Italic /></EditorButton>
          <EditorButton active={editor?.isActive("strike")} label="Strikethrough" onClick={() => editor?.chain().focus().toggleStrike().run()}><Strikethrough /></EditorButton>
          <EditorButton active={editor?.isActive("code")} label="Inline code" onClick={() => editor?.chain().focus().toggleCode().run()}><Code /></EditorButton>
          <EditorButton active={editor?.isActive("heading", { level: 2 })} label="Heading" onClick={() => editor?.chain().focus().toggleHeading({ level: 2 }).run()}><Heading2 /></EditorButton>
          <EditorButton active={editor?.isActive("bulletList")} label="Bulleted list" onClick={() => editor?.chain().focus().toggleBulletList().run()}><List /></EditorButton>
          <EditorButton active={editor?.isActive("orderedList")} label="Numbered list" onClick={() => editor?.chain().focus().toggleOrderedList().run()}><ListOrdered /></EditorButton>
          <EditorButton active={editor?.isActive("blockquote")} label="Quote" onClick={() => editor?.chain().focus().toggleBlockquote().run()}><Quote /></EditorButton>
          <EditorButton active={mentionOpen} label="Mention member" onClick={() => setMentionOpen((current) => !current)}><AtSign /></EditorButton>
          {canUpload ? <EditorButton active={imageOpen} label="Add image" onClick={() => setImageOpen((current) => !current)}><ImagePlus /></EditorButton> : null}
          <span className="forum-editor-toolbar-spacer" />
          <EditorButton label="Undo" onClick={() => editor?.chain().focus().undo().run()}><Undo2 /></EditorButton>
          <EditorButton label="Redo" onClick={() => editor?.chain().focus().redo().run()}><Redo2 /></EditorButton>
        </div>
        {mentionOpen ? (
          <div className="mention-picker">
            <input aria-label="Find a member to mention" autoFocus onChange={(event) => setMentionQuery(event.target.value)} placeholder="Search members" type="search" value={mentionQuery} />
            {visibleMembers.length ? <ul>{visibleMembers.map((member) => <li key={member.id}><button onClick={() => insertMention(member.handle)} type="button"><strong>@{member.handle}</strong><span>{member.displayName}</span></button></li>)}</ul> : null}
          </div>
        ) : null}
        {imageOpen ? (
          <div className="editor-image-picker">
            <ImageUploader
              description="The image is checked before it is added to this post."
              label="Post image"
              onUploaded={(asset) => insertImage(asset.id, asset.originalFileName)}
              placeId={placeId}
              shape="landscape"
            />
          </div>
        ) : null}
        <EditorContent editor={editor} />
      </div>
    </div>
  );
}

function EditorButton({ active = false, children, label, onClick }: { active?: boolean; children: React.ReactNode; label: string; onClick: () => void }) {
  return <button aria-label={label} aria-pressed={active} className={active ? "active" : undefined} onClick={onClick} title={label} type="button">{children}</button>;
}

export function toForumDocument(value: JSONContent): RichTextDocumentContract {
  const content = (value.content ?? []).map(cleanNode).filter((node): node is RichTextNodeContract => node !== null);
  return { type: "doc", version: 1, content };
}

function cleanNode(node: JSONContent): RichTextNodeContract | null {
  if (node.type === "text") {
    return { type: "text", text: node.text ?? "", ...(cleanMarks(node.marks).length ? { marks: cleanMarks(node.marks) } : {}) };
  }
  if (node.type === "hardBreak") return { type: "hardBreak" };
  if (node.type === "mention" && typeof node.attrs?.handle === "string") {
    return { type: "mention", attrs: { handle: node.attrs.handle.toLowerCase() } };
  }
  if (node.type === "image" && typeof node.attrs?.assetId === "string") {
    return {
      type: "image",
      attrs: {
        alt: typeof node.attrs.alt === "string" ? node.attrs.alt.slice(0, 500) : "",
        assetId: node.attrs.assetId,
      },
    };
  }
  const supported = ["paragraph", "heading", "blockquote", "bulletList", "orderedList", "listItem", "codeBlock"] as const;
  if (!supported.includes(node.type as (typeof supported)[number])) return null;
  const content = (node.content ?? []).map(cleanNode).filter((child): child is RichTextNodeContract => child !== null);
  if (node.type === "heading") {
    const level = [1, 2, 3].includes(Number(node.attrs?.level)) ? Number(node.attrs?.level) : 2;
    return { type: "heading", attrs: { level }, content };
  }
  return { type: node.type as RichTextNodeContract["type"], content };
}

function cleanMarks(marks: JSONContent["marks"]): RichTextMarkContract[] {
  return (marks ?? []).flatMap((mark) => {
    if (["bold", "italic", "strike", "code"].includes(mark.type)) return [{ type: mark.type as RichTextMarkContract["type"] }];
    if (mark.type === "link" && typeof mark.attrs?.href === "string") return [{ type: "link", attrs: { href: mark.attrs.href } }];
    return [];
  });
}
