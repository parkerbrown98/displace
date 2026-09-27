import { useSyncExternalStore } from 'react';

export type ConnectivityState = 'connected' | 'offline';

export interface ConnectivityMonitor {
  current(): ConnectivityState;
  subscribe(listener: (state: ConnectivityState) => void): () => void;
}

export function createConnectivityMonitor(target: Window = window): ConnectivityMonitor {
  const current = (): ConnectivityState => (target.navigator.onLine ? 'connected' : 'offline');

  return {
    current,
    subscribe(listener) {
      const notify = () => listener(current());
      target.addEventListener('online', notify);
      target.addEventListener('offline', notify);
      return () => {
        target.removeEventListener('online', notify);
        target.removeEventListener('offline', notify);
      };
    },
  };
}

const browserConnectivity = createConnectivityMonitor();

export function useConnectivity(): ConnectivityState {
  return useSyncExternalStore(
    browserConnectivity.subscribe,
    browserConnectivity.current,
    browserConnectivity.current,
  );
}