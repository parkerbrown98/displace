import { Node, type JSONContent } from '@tiptap/core';
import { EditorContent, useEditor } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import { AtSign, Bold, Code, Heading2, ImagePlus, Italic, List, ListOrdered, Quote, Redo2, Strikethrough, Undo2, X } from 'lucide-react';
import { useDeferredValue, useEffect, useRef, useState, type ReactNode } from 'react';
import { useNativePlatform } from '../../lib/platform/platform-context';
import { useSession } from '../auth/session-provider';
import { imageFileError, uploadAsset, type Asset, type UploadProgress } from '../assets/asset-upload';
import type { MemberPage, RichTextDocument } from '../places/place-client';
import { usePlaceClient } from '../places/use-place-client';

const MentionNode = Node.create({
  name: 'mention', group: 'inline', inline: true, atom: true,
  addAttributes: () => ({ handle: { default: null } }),
  parseHTML: () => [{ tag: 'span[data-mention]', getAttrs: (element) => ({ handle: (element as HTMLElement).dataset.mention }) }],
  renderHTML: ({ node }) => ['span', { 'data-mention': node.attrs.handle, class: 'editor-mention' }, `@${node.attrs.handle}`],
  renderText: ({ node }) => `@${node.attrs.handle}`,
});

const AssetImageNode = Node.create({
  name: 'image', group: 'block', atom: true,
  addAttributes: () => ({ alt: { default: '' }, assetId: { default: null } }),
  parseHTML: () => [{ tag: 'figure[data-asset-id]', getAttrs: (element) => ({ alt: (element as HTMLElement).dataset.alt ?? '', assetId: (element as HTMLElement).dataset.assetId }) }],
  renderHTML: ({ node }) => ['figure', { 'data-alt': node.attrs.alt, 'data-asset-id': node.attrs.assetId, class: 'editor-asset-image' }, ['span', {}, node.attrs.alt || 'Uploaded image']],
});

const extensions = [StarterKit.configure({ heading: { levels: [1, 2, 3] }, horizontalRule: false }), MentionNode, AssetImageNode];

export function ForumEditor({ canUpload = false, initialDocument, label, onChange, placeId }: { canUpload?: boolean; initialDocument?: RichTextDocument; label: string; onChange: (document: RichTextDocument, isEmpty: boolean) => void; placeId: string }) {
  const client = usePlaceClient();
  const [mentionOpen, setMentionOpen] = useState(false);
  const [imageOpen, setImageOpen] = useState(false);
  const [mentionQuery, setMentionQuery] = useState('');
  const [members, setMembers] = useState<MemberPage['items']>([]);
  const deferredQuery = useDeferredValue(mentionQuery.trim());
  const editor = useEditor({
    content: initialDocument,
    editorProps: { attributes: { 'aria-label': label, role: 'textbox' } },
    extensions,
    immediatelyRender: false,
    onCreate: ({ editor: current }) => onChange(toForumDocument(current.getJSON()), current.isEmpty),
    onUpdate: ({ editor: current }) => onChange(toForumDocument(current.getJSON()), current.isEmpty),
  });

  useEffect(() => {
    if (!mentionOpen || deferredQuery.length < 2) return;
    let active = true;
    const timeout = window.setTimeout(() => void client.members(placeId, deferredQuery).then((result) => {
      if (active) setMembers(result.items.slice(0, 8));
    }).catch(() => { if (active) setMembers([]); }), 200);
    return () => { active = false; window.clearTimeout(timeout); };
  }, [client, deferredQuery, mentionOpen, placeId]);

  function insertMention(handle: string) {
    editor?.chain().focus().insertContent([{ type: 'mention', attrs: { handle } }, { type: 'text', text: ' ' }]).run();
    setMentionOpen(false);
    setMentionQuery('');
  }

  function insertImage(asset: Asset) {
    editor?.chain().focus().insertContent({ type: 'image', attrs: { alt: asset.originalFileName, assetId: asset.id } }).run();
    setImageOpen(false);
  }

  return <label className="forum-editor-field"><span>{label}</span><div className="forum-editor">
    <div className="forum-editor-toolbar" role="toolbar" aria-label="Formatting tools">
      <EditorButton active={editor?.isActive('bold')} label="Bold" onClick={() => editor?.chain().focus().toggleBold().run()}><Bold /></EditorButton>
      <EditorButton active={editor?.isActive('italic')} label="Italic" onClick={() => editor?.chain().focus().toggleItalic().run()}><Italic /></EditorButton>
      <EditorButton active={editor?.isActive('strike')} label="Strikethrough" onClick={() => editor?.chain().focus().toggleStrike().run()}><Strikethrough /></EditorButton>
      <EditorButton active={editor?.isActive('code')} label="Inline code" onClick={() => editor?.chain().focus().toggleCode().run()}><Code /></EditorButton>
      <EditorButton active={editor?.isActive('heading', { level: 2 })} label="Heading" onClick={() => editor?.chain().focus().toggleHeading({ level: 2 }).run()}><Heading2 /></EditorButton>
      <EditorButton active={editor?.isActive('bulletList')} label="Bulleted list" onClick={() => editor?.chain().focus().toggleBulletList().run()}><List /></EditorButton>
      <EditorButton active={editor?.isActive('orderedList')} label="Numbered list" onClick={() => editor?.chain().focus().toggleOrderedList().run()}><ListOrdered /></EditorButton>
      <EditorButton active={editor?.isActive('blockquote')} label="Quote" onClick={() => editor?.chain().focus().toggleBlockquote().run()}><Quote /></EditorButton>
      <EditorButton active={mentionOpen} label="Mention member" onClick={() => setMentionOpen((value) => !value)}><AtSign /></EditorButton>
      {canUpload ? <EditorButton active={imageOpen} label="Add image" onClick={() => setImageOpen((value) => !value)}><ImagePlus /></EditorButton> : null}
      <span className="toolbar-spacer" />
      <EditorButton label="Undo" onClick={() => editor?.chain().focus().undo().run()}><Undo2 /></EditorButton>
      <EditorButton label="Redo" onClick={() => editor?.chain().focus().redo().run()}><Redo2 /></EditorButton>
    </div>
    {mentionOpen ? <div className="editor-popover"><input autoFocus aria-label="Find a member to mention" onChange={(event) => setMentionQuery(event.target.value)} placeholder="Search members" type="search" value={mentionQuery} />{deferredQuery.length >= 2 ? <ul>{members.map((member) => <li key={member.id}><button onClick={() => insertMention(member.handle)} type="button"><strong>@{member.handle}</strong><span>{member.displayName}</span></button></li>)}</ul> : <small>Type at least two characters.</small>}</div> : null}
    {imageOpen ? <ImageUploadTool onClose={() => setImageOpen(false)} onUploaded={insertImage} placeId={placeId} /> : null}
    <EditorContent editor={editor} />
  </div></label>;
}

function ImageUploadTool({ onClose, onUploaded, placeId }: { onClose: () => void; onUploaded: (asset: Asset) => void; placeId: string }) {
  const platform = useNativePlatform();
  const { client } = useSession();
  const abortRef = useRef<AbortController>(null);
  const [file, setFile] = useState<File>();
  const [asset, setAsset] = useState<Asset>();
  const [progress, setProgress] = useState<UploadProgress>();
  const [error, setError] = useState<string>();

  async function choose() {
    const selected = (await platform.selectUploadFiles())[0];
    if (!selected) return;
    setAsset(undefined); setProgress(undefined); setFile(selected); setError(imageFileError(selected));
  }

  async function upload() {
    if (!file || imageFileError(file)) return;
    abortRef.current = new AbortController();
    setError(undefined);
    try {
      setAsset(await uploadAsset(client, placeId, file, { onProgress: setProgress, signal: abortRef.current.signal }));
    } catch (cause) {
      if (!(cause instanceof DOMException && cause.name === 'AbortError')) setError(cause instanceof Error ? cause.message : 'The image could not be uploaded.');
    }
  }

  function remove() { abortRef.current?.abort(); setAsset(undefined); setError(undefined); setFile(undefined); setProgress(undefined); }

  return <div className="editor-popover upload-tool"><header><strong>Add an image</strong><button aria-label="Close image upload" onClick={onClose} type="button"><X /></button></header>
    {file ? <div className="upload-file"><span>{file.name}</span><small>{formatBytes(file.size)}</small></div> : <p>JPEG, PNG, or WebP. Up to 25 MB.</p>}
    {progress ? <div className="upload-progress"><progress max="100" value={progress.percent} /><span>{progress.stage}</span></div> : null}
    {error ? <p className="form-message error">{error}</p> : null}
    <div className="upload-actions">
      {!file ? <button className="button secondary" onClick={() => void choose()} type="button">Choose image</button> : null}
      {file && !asset && progress?.stage !== 'uploading' ? <button className="button secondary" onClick={() => void upload()} type="button">{error ? 'Retry upload' : 'Upload'}</button> : null}
      {progress?.stage === 'uploading' || progress?.stage === 'processing' ? <button className="button secondary" onClick={() => abortRef.current?.abort()} type="button">Cancel</button> : null}
      {asset ? <button className="button primary" onClick={() => onUploaded(asset)} type="button">Insert image</button> : null}
      {file ? <button className="button secondary" onClick={remove} type="button">Remove</button> : null}
    </div>
  </div>;
}

function EditorButton({ active = false, children, label, onClick }: { active?: boolean; children: ReactNode; label: string; onClick: () => void }) {
  return <button aria-label={label} aria-pressed={active} onClick={onClick} title={label} type="button">{children}</button>;
}

export function toForumDocument(value: JSONContent): RichTextDocument {
  return { content: (value.content ?? []).map(cleanNode).filter((node): node is Record<string, unknown> => node !== null), type: 'doc', version: 1 };
}

function cleanNode(node: JSONContent): Record<string, unknown> | null {
  if (node.type === 'text') {
    const marks = cleanMarks(node.marks);
    return { type: 'text', text: node.text ?? '', ...(marks.length ? { marks } : {}) };
  }
  if (node.type === 'hardBreak') return { type: 'hardBreak' };
  if (node.type === 'mention' && typeof node.attrs?.handle === 'string') return { type: 'mention', attrs: { handle: node.attrs.handle.toLowerCase() } };
  if (node.type === 'image' && typeof node.attrs?.assetId === 'string') return { type: 'image', attrs: { alt: typeof node.attrs.alt === 'string' ? node.attrs.alt.slice(0, 500) : '', assetId: node.attrs.assetId } };
  const supported = ['paragraph', 'heading', 'blockquote', 'bulletList', 'orderedList', 'listItem', 'codeBlock'];
  if (!supported.includes(node.type ?? '')) return null;
  const content = (node.content ?? []).map(cleanNode).filter((child): child is Record<string, unknown> => child !== null);
  if (node.type === 'heading') {
    const candidate = Number(node.attrs?.level);
    const level = candidate === 1 || candidate === 2 || candidate === 3 ? candidate : 2;
    return { type: 'heading', attrs: { level }, content };
  }
  return { type: node.type, content };
}

function cleanMarks(marks: JSONContent['marks']): Record<string, unknown>[] {
  return (marks ?? []).flatMap((mark) => {
    if (['bold', 'italic', 'strike', 'code'].includes(mark.type)) return [{ type: mark.type }];
    if (mark.type === 'link' && typeof mark.attrs?.href === 'string') return [{ type: 'link', attrs: { href: mark.attrs.href } }];
    return [];
  });
}

function formatBytes(bytes: number): string { return `${(bytes / (1024 * 1024)).toFixed(1)} MB`; }