export type RealtimeEventHandler<T = unknown> = (payload: T) => void;

export interface RealtimeConnection {
  close(): void;
  subscribe<T>(event: string, handler: RealtimeEventHandler<T>): () => void;
}

export interface RealtimeTransport {
  connect(accessToken: string): Promise<RealtimeConnection>;
}

export function createFixtureRealtimeTransport(): RealtimeTransport {
  return {
    async connect() {
      const handlers = new Map<string, Set<RealtimeEventHandler>>();
      return {
        close() {
          handlers.clear();
        },
        subscribe<T>(event: string, handler: RealtimeEventHandler<T>) {
          const listeners = handlers.get(event) ?? new Set<RealtimeEventHandler>();
          listeners.add(handler as RealtimeEventHandler);
          handlers.set(event, listeners);
          return () => listeners.delete(handler as RealtimeEventHandler);
        },
      };
    },
  };
}