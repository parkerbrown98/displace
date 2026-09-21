import { authenticatedMutation, authenticatedRead } from "@/features/auth/auth-client";
import type { PostContract, TopicContract } from "@/features/public-content/public-contracts";
import type { PostRevisionContract, RichTextDocumentContract, SavedPageContract, SavedPostContract, SavedTopicContract } from "./forum-contract";

const placePath = (placeId: string) => `/places/${encodeURIComponent(placeId)}`;
const idempotencyHeaders = () => ({ "Idempotency-Key": crypto.randomUUID() });

export function createTopic(placeId: string, forumId: string, input: { title: string; tagIds: string[]; document: RichTextDocumentContract }): Promise<TopicContract> {
  return authenticatedMutation(`${placePath(placeId)}/forums/${encodeURIComponent(forumId)}/topics`, {
    body: input,
    headers: idempotencyHeaders(),
    method: "POST",
  });
}

export function createReply(placeId: string, topicId: string, document: RichTextDocumentContract): Promise<PostContract> {
  return authenticatedMutation(`${placePath(placeId)}/topics/${encodeURIComponent(topicId)}/posts`, {
    body: { document },
    headers: idempotencyHeaders(),
    method: "POST",
  });
}

export function updateTopic(placeId: string, topicId: string, input: { title?: string; tagIds?: string[] }): Promise<TopicContract> {
  return authenticatedMutation(`${placePath(placeId)}/topics/${encodeURIComponent(topicId)}`, { body: input, method: "PATCH" });
}

export function deleteTopic(placeId: string, topicId: string): Promise<void> {
  return authenticatedMutation(`${placePath(placeId)}/topics/${encodeURIComponent(topicId)}`, { method: "DELETE" });
}

export function editPost(placeId: string, postId: string, document: RichTextDocumentContract, expectedVersion: number): Promise<PostContract> {
  return authenticatedMutation(`${placePath(placeId)}/posts/${encodeURIComponent(postId)}`, {
    body: { document, expectedVersion },
    method: "PATCH",
  });
}

export function deletePost(placeId: string, postId: string): Promise<void> {
  return authenticatedMutation(`${placePath(placeId)}/posts/${encodeURIComponent(postId)}`, { method: "DELETE" });
}

export function listPostRevisions(placeId: string, postId: string): Promise<PostRevisionContract[]> {
  return authenticatedRead(`${placePath(placeId)}/posts/${encodeURIComponent(postId)}/revisions`);
}

export function setReaction(placeId: string, postId: string, reaction: string, enabled: boolean): Promise<void> {
  const path = `${placePath(placeId)}/posts/${encodeURIComponent(postId)}/reactions`;
  return authenticatedMutation(enabled ? path : `${path}/${encodeURIComponent(reaction)}`, {
    body: enabled ? { reaction } : undefined,
    method: enabled ? "POST" : "DELETE",
  });
}

export function setTopicFollow(placeId: string, topicId: string, enabled: boolean): Promise<void> {
  return authenticatedMutation(`${placePath(placeId)}/topics/${encodeURIComponent(topicId)}/follow`, { method: enabled ? "POST" : "DELETE" });
}

export function setTopicSave(placeId: string, topicId: string, enabled: boolean): Promise<void> {
  return authenticatedMutation(`${placePath(placeId)}/topics/${encodeURIComponent(topicId)}/save`, { method: enabled ? "POST" : "DELETE" });
}

export function setPostSave(placeId: string, postId: string, enabled: boolean): Promise<void> {
  return authenticatedMutation(`${placePath(placeId)}/posts/${encodeURIComponent(postId)}/save`, { method: enabled ? "POST" : "DELETE" });
}

export function markTopicRead(placeId: string, topicId: string, lastReadPostId?: string): Promise<void> {
  return authenticatedMutation(`${placePath(placeId)}/topics/${encodeURIComponent(topicId)}/read`, {
    body: lastReadPostId ? { lastReadPostId } : {},
    method: "PUT",
  });
}

export function markTopicUnread(placeId: string, topicId: string): Promise<void> {
  return authenticatedMutation(`${placePath(placeId)}/topics/${encodeURIComponent(topicId)}/read`, { method: "DELETE" });
}

export function setTopicLock(placeId: string, topicId: string, enabled: boolean): Promise<TopicContract> {
  return authenticatedMutation(`${placePath(placeId)}/topics/${encodeURIComponent(topicId)}/lock`, { method: enabled ? "POST" : "DELETE" });
}

export function setTopicPin(placeId: string, topicId: string, enabled: boolean): Promise<TopicContract> {
  return authenticatedMutation(`${placePath(placeId)}/topics/${encodeURIComponent(topicId)}/pin`, { method: enabled ? "POST" : "DELETE" });
}

export function listSavedTopics(cursor?: string): Promise<SavedPageContract<SavedTopicContract>> {
  return authenticatedRead(`/saved/topics${cursor ? `?cursor=${encodeURIComponent(cursor)}` : ""}`);
}

export function listSavedPosts(cursor?: string): Promise<SavedPageContract<SavedPostContract>> {
  return authenticatedRead(`/saved/posts${cursor ? `?cursor=${encodeURIComponent(cursor)}` : ""}`);
}
