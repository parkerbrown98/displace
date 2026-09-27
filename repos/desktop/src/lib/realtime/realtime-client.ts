import { io, type Socket } from 'socket.io-client';
import type { ClientToServerEvents, ServerToClientEvents } from '@displace/api-client';

export type RealtimeConnectionState = 'connected' | 'connecting' | 'offline' | 'reconnecting' | 'stopped';
export type RealtimeSocket = Socket<ServerToClientEvents, ClientToServerEvents>;

interface RealtimeClientOptions {
  apiOrigin: string;
  getAccessToken: () => string | null;
  renewAuthentication: () => Promise<string | null>;
  socketFactory?: (url: string, options: Parameters<typeof io>[1]) => RealtimeSocket;
  target?: Pick<Window, 'addEventListener' | 'removeEventListener' | 'navigator'>;
  visibility?: Pick<Document, 'addEventListener' | 'removeEventListener' | 'visibilityState'>;
}

export class RealtimeClient {
  #authRetryPending = false;
  #channelSubscriptions = new Map<string, string>();
  #heartbeatTimer: number | undefined;
  #placeSubscriptions = new Set<string>();
  #socket: RealtimeSocket | null = null;
  #state: RealtimeConnectionState = 'stopped';
  #stateListeners = new Set<() => void>();
  readonly #socketFactory: NonNullable<RealtimeClientOptions['socketFactory']>;
  readonly #target: RealtimeClientOptions['target'];
  readonly #visibility: RealtimeClientOptions['visibility'];

  constructor(private readonly options: RealtimeClientOptions) {
    this.#socketFactory = options.socketFactory ?? ((url, socketOptions) => io(url, socketOptions));
    this.#target = options.target ?? window;
    this.#visibility = options.visibility ?? document;
  }

  get state(): RealtimeConnectionState {
    return this.#state;
  }

  get socket(): RealtimeSocket | null {
    return this.#socket;
  }

  start(): void {
    if (this.#socket) return;
    const token = this.options.getAccessToken();
    if (!token || !this.#target?.navigator.onLine) {
      this.setState(token ? 'offline' : 'stopped');
      return;
    }
    const endpoint = new URL('/realtime', this.options.apiOrigin).toString();
    this.#socket = this.#socketFactory(endpoint, {
      auth: { token },
      autoConnect: false,
      path: '/socket.io',
      reconnection: true,
      reconnectionDelay: 500,
      reconnectionDelayMax: 10_000,
      randomizationFactor: 0.4,
      transports: ['websocket'],
    });
    this.#socket.on('connect', this.handleConnect);
    this.#socket.on('connect_error', this.handleConnectError);
    this.#socket.on('disconnect', this.handleDisconnect);
    this.#target.addEventListener('online', this.handleOnline);
    this.#target.addEventListener('offline', this.handleOffline);
    this.#visibility?.addEventListener('visibilitychange', this.handleVisibilityChange);
    this.setState('connecting');
    this.#socket.connect();
  }

  stop(): void {
    this.#target?.removeEventListener('online', this.handleOnline);
    this.#target?.removeEventListener('offline', this.handleOffline);
    this.#visibility?.removeEventListener('visibilitychange', this.handleVisibilityChange);
    this.#socket?.removeAllListeners();
    this.#socket?.disconnect();
    window.clearInterval(this.#heartbeatTimer);
    this.#heartbeatTimer = undefined;
    this.#socket = null;
    this.#authRetryPending = false;
    this.#channelSubscriptions.clear();
    this.#placeSubscriptions.clear();
    this.setState('stopped');
  }

  subscribe(listener: () => void): () => void {
    this.#stateListeners.add(listener);
    return () => this.#stateListeners.delete(listener);
  }

  joinPlace(placeId: string): () => void {
    this.#placeSubscriptions.add(placeId);
    if (this.#socket?.connected) {
      this.#socket.emit('place.join', { placeId });
      this.#socket.emit('presence.heartbeat', { placeId });
    }
    return () => this.#placeSubscriptions.delete(placeId);
  }

  joinChat(placeId: string, channelId: string): () => void {
    this.#channelSubscriptions.set(channelId, placeId);
    if (this.#socket?.connected) this.#socket.emit('chat.join', { channelId, placeId });
    return () => this.#channelSubscriptions.delete(channelId);
  }

  private readonly handleConnect = () => {
    this.#authRetryPending = false;
    this.setState('connected');
    for (const placeId of this.#placeSubscriptions) this.#socket?.emit('place.join', { placeId });
    for (const [channelId, placeId] of this.#channelSubscriptions) this.#socket?.emit('chat.join', { channelId, placeId });
    this.#socket?.emit('notifications.sync');
    window.clearInterval(this.#heartbeatTimer);
    this.#heartbeatTimer = window.setInterval(() => {
      for (const placeId of this.#placeSubscriptions) this.#socket?.emit('presence.heartbeat', { placeId });
    }, 30_000);
  };

  private readonly handleConnectError = (error: Error) => {
    this.setState(this.#target?.navigator.onLine ? 'reconnecting' : 'offline');
    if (this.#authRetryPending || !isAuthenticationError(error)) return;
    this.#authRetryPending = true;
    void this.options.renewAuthentication().then((token) => {
      if (!token || !this.#socket) return this.stop();
      this.#socket.auth = { token };
      this.#socket.connect();
    }).catch(() => this.stop());
  };

  private readonly handleDisconnect = () => {
    window.clearInterval(this.#heartbeatTimer);
    this.#heartbeatTimer = undefined;
    this.setState(this.#target?.navigator.onLine ? 'reconnecting' : 'offline');
  };

  private readonly handleOffline = () => {
    this.#socket?.disconnect();
    this.setState('offline');
  };

  private readonly handleOnline = () => {
    if (!this.#socket) this.start();
    else {
      this.#socket.auth = { token: this.options.getAccessToken() };
      this.setState('connecting');
      this.#socket.connect();
    }
  };

  private readonly handleVisibilityChange = () => {
    if (this.#visibility?.visibilityState === 'visible') this.handleOnline();
  };

  private setState(state: RealtimeConnectionState): void {
    if (this.#state === state) return;
    this.#state = state;
    this.#stateListeners.forEach((listener) => listener());
  }
}

function isAuthenticationError(error: Error): boolean {
  const data = 'data' in error ? (error as Error & { data?: { status?: number } }).data : undefined;
  return data?.status === 401 || /auth|token|unauthorized/i.test(error.message);
}