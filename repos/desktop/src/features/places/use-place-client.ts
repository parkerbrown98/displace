import { useState } from 'react';
import { useSession } from '../auth/session-provider';
import { PlaceClient } from './place-client';

export function usePlaceClient(): PlaceClient {
  const { client } = useSession();
  const [placeClient] = useState(() => new PlaceClient(client));
  return placeClient;
}