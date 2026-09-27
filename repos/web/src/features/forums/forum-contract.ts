import type { components } from '@displace/api-client';
import type {
  RichTextDocument,
  RichTextMark,
  RichTextNode,
} from '@displace/api-client';
import type { PostContract, TopicContract } from '@/features/public-content/public-contracts';

export type RichTextMarkContract = RichTextMark;
export type RichTextNodeContract = RichTextNode;
export type RichTextDocumentContract = RichTextDocument;

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
