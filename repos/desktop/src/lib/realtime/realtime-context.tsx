import { createContext, use, useEffect, useState, useSyncExternalStore, type ReactNode } from 'react';
import type { AppConfig } from '../../config/app-config';
import { useSession } from '../../features/auth/session-provider';
import { RealtimeClient, type RealtimeConnectionState } from './realtime-client';

const RealtimeContext = createContext<RealtimeClient | null>(null);

export function RealtimeProvider({ children, config }: { children: ReactNode; config: Pick<AppConfig, 'apiOrigin'> }) {
  const session = useSession();
  const [client] = useState(() => new RealtimeClient({
    apiOrigin: config.apiOrigin,
    getAccessToken: () => session.client.accessToken,
    renewAuthentication: async () => (await session.client.renewAuthentication())?.accessToken ?? null,
  }));

  useEffect(() => {
    if (session.status === 'authenticated') client.start();
    else client.stop();
    return () => client.stop();
  }, [client, session.status]);

  return <RealtimeContext value={client}>{children}</RealtimeContext>;
}

export function useRealtime(): RealtimeClient {
  const client = use(RealtimeContext);
  if (!client) throw new Error('useRealtime must be used within RealtimeProvider.');
  return client;
}

export function useRealtimeState(): RealtimeConnectionState {
  const client = useRealtime();
  return useSyncExternalStore(client.subscribe.bind(client), () => client.state, () => 'stopped');
}