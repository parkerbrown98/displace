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

export interface ForumContract {
  id: string;
  name: string;
  slug: string;
  description: string;
}

export interface ForumGroupContract {
  id: string;
  name: string;
  forums: ForumContract[];
}

export interface ForumGroupPageContract {
  items: ForumGroupContract[];
}

export interface PostRevisionContract {
  id: string;
  postId: string;
  editorUserId: string;
  document: RichTextDocumentContract;
  sanitizedHtml: string;
  plainText: string;
  version: number;
  createdAt: string;
}

export interface PostViewerStateContract {
  postId: string;
  isSaved: boolean;
  reactions: string[];
}

export interface TopicViewerStateContract {
  isFollowing: boolean;
  isSaved: boolean;
  posts: PostViewerStateContract[];
}

export interface SavedTopicContract {
  placeId: string;
  placeSlug: string;
  placeName: string;
  topic: import("@/features/public-content/public-contracts").TopicContract;
  savedAt: string;
}

export interface SavedPostContract {
  placeId: string;
  placeSlug: string;
  placeName: string;
  topicTitle: string;
  post: import("@/features/public-content/public-contracts").PostContract;
  savedAt: string;
}

export interface SavedPageContract<T> {
  items: T[];
  nextCursor?: string;
}
