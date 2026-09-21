import { vi } from 'vitest';

const redis = vi.hoisted(() => ({
  connect: vi.fn(),
  del: vi.fn(),
  disconnect: vi.fn(),
  eval: vi.fn(),
  get: vi.fn(),
  scan: vi.fn(),
}));

vi.mock('ioredis', () => ({
  Redis: vi.fn(function RedisMock() {
    return redis;
  }),
}));

import { TopicViewCounterWorker } from './topic-view-counter.worker.js';

describe('TopicViewCounterWorker', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    redis.scan
      .mockResolvedValueOnce(['0', []])
      .mockResolvedValueOnce(['0', ['displace:topic-views:topic-1']]);
    redis.eval.mockResolvedValue('3');
    redis.get.mockResolvedValue('topic-1:3');
  });

  it('atomically drains buffered views into the database', async () => {
    const forums = {
      flushViews: vi.fn().mockResolvedValue(undefined),
      pruneViewFlushes: vi.fn().mockResolvedValue(undefined),
    };
    const worker = new TopicViewCounterWorker(
      { get: vi.fn().mockReturnValue('redis://localhost') } as never,
      forums as never,
    );

    await worker.flush();

    expect(redis.eval).toHaveBeenCalledWith(
      expect.any(String),
      2,
      'displace:topic-views:topic-1',
      expect.stringMatching(/^displace:topic-view-batches:/),
      'topic-1',
      2_592_000,
    );
    expect(forums.flushViews).toHaveBeenCalledWith(
      expect.any(String),
      'topic-1',
      3,
    );
    expect(redis.del).toHaveBeenCalledWith(
      expect.stringMatching(/^displace:topic-view-batches:/),
    );
    expect(forums.pruneViewFlushes).toHaveBeenCalledWith(expect.any(Date));
  });

  it('retains the processing batch when persistence fails', async () => {
    const forums = {
      flushViews: vi.fn().mockRejectedValue(new Error('down')),
      pruneViewFlushes: vi.fn().mockResolvedValue(undefined),
    };
    const worker = new TopicViewCounterWorker(
      { get: vi.fn().mockReturnValue('redis://localhost') } as never,
      forums as never,
    );

    await worker.flush();

    expect(redis.del).not.toHaveBeenCalled();
  });

  it('retries a processing batch left by an earlier worker run', async () => {
    redis.scan
      .mockReset()
      .mockResolvedValueOnce(['0', ['displace:topic-view-batches:batch-1']])
      .mockResolvedValueOnce(['0', []]);
    const forums = {
      flushViews: vi.fn().mockResolvedValue(undefined),
      pruneViewFlushes: vi.fn().mockResolvedValue(undefined),
    };
    const worker = new TopicViewCounterWorker(
      { get: vi.fn().mockReturnValue('redis://localhost') } as never,
      forums as never,
    );

    await worker.flush();

    expect(redis.eval).not.toHaveBeenCalled();
    expect(forums.flushViews).toHaveBeenCalledWith('batch-1', 'topic-1', 3);
    expect(redis.del).toHaveBeenCalledWith('displace:topic-view-batches:batch-1');
  });

  it('contains scheduled Redis failures and disconnects during shutdown', async () => {
    vi.useFakeTimers();
    redis.scan.mockReset().mockRejectedValue(new Error('redis down'));
    const worker = new TopicViewCounterWorker(
      { get: vi.fn().mockReturnValue('redis://localhost') } as never,
      {
        flushViews: vi.fn(),
        pruneViewFlushes: vi.fn(),
      } as never,
    );

    try {
      await worker.onApplicationBootstrap();
      await vi.advanceTimersByTimeAsync(60_000);
      await worker.onApplicationShutdown();

      expect(redis.scan).toHaveBeenCalled();
      expect(redis.disconnect).toHaveBeenCalledOnce();
    } finally {
      vi.useRealTimers();
    }
  });

  it('bounds the shutdown flush when Redis stops responding', async () => {
    vi.useFakeTimers();
    redis.scan.mockReset().mockImplementation(() => new Promise(() => undefined));
    const worker = new TopicViewCounterWorker(
      { get: vi.fn().mockReturnValue('redis://localhost') } as never,
      {
        flushViews: vi.fn(),
        pruneViewFlushes: vi.fn(),
      } as never,
    );

    try {
      await worker.onApplicationBootstrap();
      const shutdown = worker.onApplicationShutdown();
      await vi.advanceTimersByTimeAsync(10_000);
      await shutdown;

      expect(redis.disconnect).toHaveBeenCalledOnce();
    } finally {
      vi.useRealTimers();
    }
  });
});