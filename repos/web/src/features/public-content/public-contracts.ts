import type { components } from '@displace/api-client';
import type {
  RichTextDocument,
  RichTextMark,
  RichTextNode,
} from '@displace/api-client';

export type ForumContract = components['schemas']['ForumDto'];
export type ForumGroupContract = components['schemas']['ForumGroupDto'];
export type ForumTagContract = components['schemas']['ForumTagDto'];
export type ForumNavigationContract = components['schemas']['ForumNavigationDto'];
export type TopicContract = components['schemas']['TopicDto'];
export type TopicPageContract = components['schemas']['TopicPageDto'];

export type RichTextMarkContract = RichTextMark;
export type RichTextNodeContract = RichTextNode;
export type RichTextDocumentContract = RichTextDocument;

export type PostContract = Omit<components['schemas']['PostDto'], 'document'> & {
  document: RichTextDocumentContract | null;
};
export type PostPageContract = Omit<components['schemas']['PostPageDto'], 'items'> & {
  items: PostContract[];
};
export type PublicProfileContract = components['schemas']['PublicProfileDto'];

export type SearchResultContract = components['schemas']['SearchResultDto'];
export type SearchPageContract = components['schemas']['SearchPageDto'];