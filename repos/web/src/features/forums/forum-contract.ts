import type { components } from '@displace/api-client';
import type { PostContract, TopicContract } from '@/features/public-content/public-contracts';

export interface RichTextMarkContract {
  type: "bold" | "italic" | "strike" | "code" | "link";
  attrs?: { href?: string };
}

export interface RichTextNodeContract {
  type: "paragraph" | "heading" | "blockquote" | "bulletList" | "orderedList" | "listItem" | "codeBlock" | "text" | "hardBreak" | "mention" | "image";
  attrs?: { handle?: string; level?: number; assetId?: string; alt?: string };
  content?: RichTextNodeContract[];
  marks?: RichTextMarkContract[];
  text?: string;
}

export interface RichTextDocumentContract {
  type: "doc";
  version: 1;
  content: RichTextNodeContract[];
}

export type PostRevisionContract = Omit<components['schemas']['PostRevisionDto'], 'document'> & {
  document: RichTextDocumentContract;
};

export type PostViewerStateContract = components['schemas']['PostViewerStateDto'];
export type TopicViewerStateContract = components['schemas']['TopicViewerStateDto'];

export type SavedTopicContract = Omit<components['schemas']['SavedTopicDto'], 'topic'> & {
  topic: TopicContract;
};

export type SavedPostContract = Omit<components['schemas']['SavedPostDto'], 'post'> & {
  post: PostContract;
};

export type SavedTopicPageContract = Omit<components['schemas']['SavedTopicPageDto'], 'items'> & { items: SavedTopicContract[] };
export type SavedPostPageContract = Omit<components['schemas']['SavedPostPageDto'], 'items'> & { items: SavedPostContract[] };
