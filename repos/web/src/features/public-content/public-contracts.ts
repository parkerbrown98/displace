import type { components } from '@displace/api-client';

export type ForumContract = components['schemas']['ForumDto'];
export type ForumGroupContract = components['schemas']['ForumGroupDto'];
export type ForumTagContract = components['schemas']['ForumTagDto'];
export type ForumNavigationContract = components['schemas']['ForumNavigationDto'];
export type TopicContract = components['schemas']['TopicDto'];
export type TopicPageContract = components['schemas']['TopicPageDto'];

export interface RichTextMarkContract {
  attrs?: { alt?: string; assetId?: string; handle?: string; level?: number } & Record<string, unknown>;
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

export type PostContract = Omit<components['schemas']['PostDto'], 'document'> & {
  document: RichTextDocumentContract | null;
};
export type PostPageContract = Omit<components['schemas']['PostPageDto'], 'items'> & {
  items: PostContract[];
};
export type PublicProfileContract = components['schemas']['PublicProfileDto'];

export type SearchResultContract = components['schemas']['SearchResultDto'];
export type SearchPageContract = components['schemas']['SearchPageDto'];