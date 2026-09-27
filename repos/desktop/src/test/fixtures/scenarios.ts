export type ScenarioName =
  | 'connected'
  | 'offline'
  | 'unauthenticated'
  | 'expired'
  | 'forbidden'
  | 'pending'
  | 'deleted'
  | 'slow'
  | 'failed';

export interface ScenarioFixture {
  authenticated: boolean;
  connectivity: 'connected' | 'offline';
  delayMs: number;
  responseStatus: number | null;
}

export const scenarioFixtures: Record<ScenarioName, ScenarioFixture> = {
  connected: { authenticated: true, connectivity: 'connected', delayMs: 0, responseStatus: 200 },
  offline: { authenticated: true, connectivity: 'offline', delayMs: 0, responseStatus: null },
  unauthenticated: { authenticated: false, connectivity: 'connected', delayMs: 0, responseStatus: 401 },
  expired: { authenticated: true, connectivity: 'connected', delayMs: 0, responseStatus: 401 },
  forbidden: { authenticated: true, connectivity: 'connected', delayMs: 0, responseStatus: 403 },
  pending: { authenticated: true, connectivity: 'connected', delayMs: 0, responseStatus: 202 },
  deleted: { authenticated: true, connectivity: 'connected', delayMs: 0, responseStatus: 410 },
  slow: { authenticated: true, connectivity: 'connected', delayMs: 2_000, responseStatus: 200 },
  failed: { authenticated: true, connectivity: 'connected', delayMs: 0, responseStatus: 500 },
};