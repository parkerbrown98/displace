import type {
  ForumNavigationContract,
  PostPageContract,
  TopicPageContract,
} from "./public-contracts";

export const publicIds = {
  showcaseForum: "01990000-7000-8000-8000-000000000101",
  engineeringForum: "01990000-7000-8000-8000-000000000102",
  weeklyTopic: "01990000-7000-8000-8000-000000000201",
  netcodeTopic: "01990000-7000-8000-8000-000000000202",
} as const;

export const forumNavigationFixture: ForumNavigationContract = {
  groups: [
    {
      id: "01990000-7000-8000-8000-000000000100",
      name: "Game development",
      description: "Build notes, techniques, and critique.",
      position: 0,
      forums: [
        {
          id: publicIds.showcaseForum,
          groupId: "01990000-7000-8000-8000-000000000100",
          name: "Showcase",
          description: "Share work in progress and finished releases.",
          position: 0,
          visibility: "public",
          readPermission: null,
          writePermission: null,
        },
        {
          id: publicIds.engineeringForum,
          groupId: "01990000-7000-8000-8000-000000000100",
          name: "Engineering",
          description: "Rendering, networking, tools, and architecture.",
          position: 1,
          visibility: "public",
          readPermission: null,
          writePermission: null,
        },
      ],
    },
  ],
  tags: [
    { id: "01990000-7000-8000-8000-000000000110", slug: "devlog", name: "Devlog", color: "#255F5B" },
    { id: "01990000-7000-8000-8000-000000000111", slug: "networking", name: "Networking", color: "#CF654E" },
  ],
};

export const topicPageFixture: TopicPageContract = {
  items: [
    {
      id: publicIds.weeklyTopic,
      forumId: publicIds.showcaseForum,
      authorUserId: "01990000-7000-8000-8000-000000000301",
      title: "What are you building this week?",
      status: "open",
      isPinned: true,
      replyCount: 42,
      viewCount: 1204,
      previewImage: {
        alt: "Dialogue tool preview",
        assetId: "01990000-7000-8000-8000-000000000501",
      },
      tags: [forumNavigationFixture.tags[0]!],
      latestPostAt: "2026-09-20T12:52:00.000Z",
      createdAt: "2026-09-15T09:00:00.000Z",
    },
    {
      id: publicIds.netcodeTopic,
      forumId: publicIds.engineeringForum,
      authorUserId: "01990000-7000-8000-8000-000000000302",
      title: "Rollback netcode: practical resources and tradeoffs",
      status: "open",
      isPinned: false,
      replyCount: 18,
      viewCount: 684,
      previewImage: null,
      tags: [forumNavigationFixture.tags[1]!],
      latestPostAt: "2026-09-20T12:26:00.000Z",
      createdAt: "2026-09-18T15:30:00.000Z",
    },
  ],
  nextCursor: "eyJsYXRlc3RQb3N0QXQiOiIyMDI2LTA5LTIwVDEyOjI2OjAwLjAwMFoifQ",
};

export const postPageFixture: PostPageContract = {
  items: [
    {
      id: "01990000-7000-8000-8000-000000000401",
      topicId: publicIds.weeklyTopic,
      authorUserId: "01990000-7000-8000-8000-000000000301",
      author: {
        displayName: "Mara Vale",
        handle: "mara_v",
        id: "01990000-7000-8000-8000-000000000301",
        joinedAt: "2025-06-12T09:00:00.000Z",
      },
      document: {
        type: "doc",
        version: 1,
        content: [
          {
            type: "paragraph",
            content: [
              { type: "text", text: "This week I am prototyping a dialogue tool with " },
              { type: "text", text: "deterministic previews", marks: [{ type: "bold" }] },
              { type: "text", text: ". What is everyone else working on?" },
            ],
          },
        ],
      },
      sanitizedHtml: "<p>This week I am prototyping a dialogue tool with <strong>deterministic previews</strong>. What is everyone else working on?</p>",
      plainText: "This week I am prototyping a dialogue tool with deterministic previews. What is everyone else working on?",
      version: 1,
      isDeleted: false,
      reactions: [{ count: 7, reacted: false, reaction: "like" }],
      createdAt: "2026-09-15T09:00:00.000Z",
      updatedAt: "2026-09-15T09:00:00.000Z",
    },
    {
      id: "01990000-7000-8000-8000-000000000402",
      topicId: publicIds.weeklyTopic,
      authorUserId: "01990000-7000-8000-8000-000000000302",
      author: {
        displayName: "Theo Grant",
        handle: "theo_g",
        id: "01990000-7000-8000-8000-000000000302",
        joinedAt: "2025-08-03T11:20:00.000Z",
      },
      document: null,
      sanitizedHtml: null,
      plainText: null,
      version: 2,
      isDeleted: true,
      reactions: [],
      createdAt: "2026-09-16T11:20:00.000Z",
      updatedAt: "2026-09-17T08:10:00.000Z",
    },
  ],
};