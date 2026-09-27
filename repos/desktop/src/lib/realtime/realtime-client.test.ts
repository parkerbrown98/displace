import { describe, expect, it, vi } from 'vitest';
import type { RealtimeSocket } from './realtime-client';
import { RealtimeClient } from './realtime-client';

class FakeSocket {
  auth: Record<string, unknown> = {};
  connected = false;
  emitted: Array<[string, unknown?]> = [];
  handlers = new Map<string, Set<(...arguments_: never[]) => void>>();

  connect() {
    return this;
  }

  disconnect() {
    this.connected = false;
    return this;
  }

  emit(event: string, payload?: unknown) {
    this.emitted.push([event, payload]);
    return this;
  }

  on(event: string, listener: (...arguments_: never[]) => void) {
    const handlers = this.handlers.get(event) ?? new Set();
    handlers.add(listener);
    this.handlers.set(event, handlers);
    return this;
  }

  removeAllListeners() {
    this.handlers.clear();
    return this;
  }

  trigger(event: string, argument?: unknown) {
    if (event === 'connect') this.connected = true;
    this.handlers.get(event)?.forEach((listener) => listener(argument as never));
  }
}

describe('RealtimeClient', () => {
  it('replays desired subscriptions whenever the socket reconnects', () => {
    const socket = new FakeSocket();
    const client = new RealtimeClient({
      apiOrigin: 'https://api.displace.test',
      getAccessToken: () => 'access-token',
      renewAuthentication: async () => 'renewed-token',
      socketFactory: () => socket as unknown as RealtimeSocket,
    });

    client.joinPlace('place-1');
    client.joinChat('place-1', 'channel-1');
    client.start();
    socket.trigger('connect');

    expect(client.state).toBe('connected');
    expect(socket.emitted).toEqual([
      ['place.join', { placeId: 'place-1' }],
      ['chat.join', { channelId: 'channel-1', placeId: 'place-1' }],
      ['notifications.sync', undefined],
    ]);
  });

  it('rotates authentication once after a rejected handshake', async () => {
    const socket = new FakeSocket();
    const renewAuthentication = vi.fn().mockResolvedValue('renewed-token');
    const client = new RealtimeClient({
      apiOrigin: 'https://api.displace.test',
      getAccessToken: () => 'expired-token',
      renewAuthentication,
      socketFactory: () => socket as unknown as RealtimeSocket,
    });

    client.start();
    socket.trigger('connect_error', new Error('Unauthorized token'));
    await vi.waitFor(() => expect(socket.auth).toEqual({ token: 'renewed-token' }));

    expect(renewAuthentication).toHaveBeenCalledOnce();
    expect(client.state).toBe('reconnecting');
  });

  it('disconnects while offline and reconnects when connectivity returns', () => {
    const socket = new FakeSocket();
    const client = new RealtimeClient({
      apiOrigin: 'https://api.displace.test',
      getAccessToken: () => 'access-token',
      renewAuthentication: async () => 'renewed-token',
      socketFactory: () => socket as unknown as RealtimeSocket,
    });

    client.start();
    window.dispatchEvent(new Event('offline'));
    expect(client.state).toBe('offline');

    window.dispatchEvent(new Event('online'));
    expect(client.state).toBe('connecting');
  });
});