import { createContext, use } from 'react';
import type { NativePlatform } from './native-platform';

export const PlatformContext = createContext<NativePlatform | null>(null);

export function useNativePlatform(): NativePlatform {
  const platform = use(PlatformContext);
  if (!platform) throw new Error('useNativePlatform must be used within PlatformContext.');
  return platform;
}