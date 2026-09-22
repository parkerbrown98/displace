export interface ChatChannelContract {
  archived: boolean;
  id: string;
  name: string;
  position: number;
  readPermission: string | null;
  sendPermission: string | null;
  slug: string;
  visibility: string;
}

export interface ChatMessageContract {
  author: { displayName: string; handle: string; id: string };
  body: string | null;
  channelId: string;
  createdAt: string;
  id: string;
  isDeleted: boolean;
  updatedAt: string;
}

export interface ChatMessagePageContract {
  channel: ChatChannelContract;
  items: ChatMessageContract[];
  nextCursor?: string;
  permissions: { canManage: boolean; canSend: boolean };
}