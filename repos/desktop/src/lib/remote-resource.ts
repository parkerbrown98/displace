import { startTransition, useEffect, useEffectEvent, useState } from 'react';

type RemoteState<T> =
  | { status: 'loading' }
  | { status: 'ready'; data: T }
  | { status: 'error'; error: unknown };

interface RemoteSnapshot<T> {
  requestKey: string;
  state: RemoteState<T>;
}

export function useRemoteResource<T>(key: string, load: () => Promise<T>) {
  const [revision, setRevision] = useState(0);
  const requestKey = `${key}\0${revision}`;
  const [snapshot, setSnapshot] = useState<RemoteSnapshot<T>>({
    requestKey,
    state: { status: 'loading' },
  });
  const loadResource = useEffectEvent(load);

  useEffect(() => {
    let active = true;
    void loadResource().then((data) => {
      if (active) startTransition(() => setSnapshot({ requestKey, state: { data, status: 'ready' } }));
    }).catch((error: unknown) => {
      if (active) setSnapshot({ requestKey, state: { error, status: 'error' } });
    });
    return () => { active = false; };
  }, [requestKey]);

  const state: RemoteState<T> = snapshot.requestKey === requestKey ? snapshot.state : { status: 'loading' };
  return { reload: () => setRevision((value) => value + 1), state };
}