export const DEPENDENCY_PROBE = Symbol('DEPENDENCY_PROBE');

export interface DependencyProbe {
  checkPostgres(): Promise<void>;
  checkRedis(): Promise<void>;
  checkObjectStorage(): Promise<void>;
  checkSearch(): Promise<void>;
  checkVoice(): Promise<void>;
}
