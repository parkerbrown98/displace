export interface ForumContract {
  id: string;
  groupId: string;
  name: string;
  description: string;
  position: number;
  visibility: "members" | "public";
  readPermission: string | null;
  writePermission: string | null;
}

export interface ForumGroupContract {
  id: string;
  name: string;
  description: string;
  position: number;
  forums: ForumContract[];
}

export interface ForumTagContract {
  id: string;
  slug: string;
  name: string;
  color: string | null;
}

export interface ForumNavigationContract {
  groups: ForumGroupContract[];
  tags: ForumTagContract[];
}

export interface TopicContract {
  id: string;
  forumId: string;
  authorUserId: string;
  title: string;
  status: "locked" | "open";
  isPinned: boolean;
  replyCount: number;
  viewCount: number;
  tags: ForumTagContract[];
  latestPostAt: string;
  createdAt: string;
}

export interface TopicPageContract {
  items: TopicContract[];
  nextCursor?: string;
}

export interface RichTextMarkContract {
  attrs?: Record<string, unknown>;
  type: string;
}

export interface RichTextNodeContract {
  attrs?: Record<string, unknown>;
  content?: RichTextNodeContract[];
  marks?: RichTextMarkContract[];
  text?: string;
  type: string;
}

export interface RichTextDocumentContract {
  content?: RichTextNodeContract[];
  type: "doc";
  version: 1;
}

export interface PostContract {
  id: string;
  topicId: string;
  authorUserId: string;
  document: RichTextDocumentContract | null;
  sanitizedHtml: string | null;
  plainText: string | null;
  version: number;
  isDeleted: boolean;
  reactions: Array<{ count: number; reacted: boolean; reaction: string }>;
  createdAt: string;
  updatedAt: string;
}

export interface PostPageContract {
  items: PostContract[];
  nextCursor?: string;
}

export interface PublicProfileFixture {
  displayName: string;
  handle: string;
  initials: string;
  joinedAt: string;
  summary: string;
}