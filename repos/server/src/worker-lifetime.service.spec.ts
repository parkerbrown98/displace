import { vi } from 'vitest';
import { WorkerLifetimeService } from './worker-lifetime.service.js';

describe('WorkerLifetimeService', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('keeps the worker active until application shutdown', () => {
    const service = new WorkerLifetimeService();

    service.onApplicationBootstrap();
    expect(vi.getTimerCount()).toBe(1);

    service.onApplicationShutdown();
    expect(vi.getTimerCount()).toBe(0);
  });
});
