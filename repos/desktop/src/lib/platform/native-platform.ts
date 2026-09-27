import { invoke } from '@tauri-apps/api/core';
import { onOpenUrl } from '@tauri-apps/plugin-deep-link';
import { open } from '@tauri-apps/plugin-dialog';
import {
  isPermissionGranted,
  requestPermission,
  sendNotification,
} from '@tauri-apps/plugin-notification';
import { check, type Update } from '@tauri-apps/plugin-updater';

export interface AppMetadata {
  architecture: string;
  name: string;
  platform: string;
  version: string;
}

export interface DiagnosticSnapshot extends AppMetadata {
  secureStorageAvailable: boolean;
}

export interface AvailableUpdate {
  currentVersion: string;
  version: string;
}

export interface UpdateProgress {
  contentLength?: number;
  downloaded: number;
}

export type Unlisten = () => void;

export interface NativePlatform {
  clearRefreshToken(): Promise<void>;
  collectDiagnostics(): Promise<DiagnosticSnapshot>;
  getAppMetadata(): Promise<AppMetadata>;
  hasRefreshToken(): Promise<boolean>;
  installAvailableUpdate(onProgress?: (progress: UpdateProgress) => void): Promise<void>;
  listenForDeepLinks(listener: (urls: string[]) => void): Promise<Unlisten>;
  notify(title: string, body: string): Promise<boolean>;
  selectUploadFiles(): Promise<string[]>;
  storeRefreshToken(refreshToken: string): Promise<void>;
  checkForUpdate(): Promise<AvailableUpdate | null>;
}

export function createNativePlatform(): NativePlatform {
  let pendingUpdate: Update | null = null;

  return {
    async checkForUpdate() {
      pendingUpdate = await check();
      return pendingUpdate
        ? { currentVersion: pendingUpdate.currentVersion, version: pendingUpdate.version }
        : null;
    },
    clearRefreshToken: () => invoke('clear_refresh_token'),
    collectDiagnostics: () => invoke('collect_diagnostics'),
    getAppMetadata: () => invoke('get_app_metadata'),
    hasRefreshToken: () => invoke('has_refresh_token'),
    async installAvailableUpdate(onProgress) {
      if (!pendingUpdate) throw new Error('No verified update is ready to install.');
      let downloaded = 0;
      await pendingUpdate.downloadAndInstall((event) => {
        if (event.event === 'Started') {
          onProgress?.({ contentLength: event.data.contentLength, downloaded: 0 });
        } else if (event.event === 'Progress') {
          downloaded += event.data.chunkLength;
          onProgress?.({ downloaded });
        }
      });
      pendingUpdate = null;
    },
    listenForDeepLinks: (listener) => onOpenUrl(listener),
    async notify(title, body) {
      let allowed = await isPermissionGranted();
      if (!allowed) allowed = (await requestPermission()) === 'granted';
      if (allowed) sendNotification({ title, body });
      return allowed;
    },
    async selectUploadFiles() {
      const selection = await open({ directory: false, multiple: true });
      if (!selection) return [];
      return Array.isArray(selection) ? selection : [selection];
    },
    storeRefreshToken: (refreshToken) => invoke('store_refresh_token', { refreshToken }),
  };
}

export class MemoryNativePlatform implements NativePlatform {
  #refreshToken: string | null = null;

  async checkForUpdate(): Promise<AvailableUpdate | null> {
    return null;
  }

  async clearRefreshToken(): Promise<void> {
    this.#refreshToken = null;
  }

  async collectDiagnostics(): Promise<DiagnosticSnapshot> {
    return { ...(await this.getAppMetadata()), secureStorageAvailable: true };
  }

  async getAppMetadata(): Promise<AppMetadata> {
    return { architecture: 'test', name: 'Displace', platform: 'test', version: '0.1.0-test' };
  }

  async hasRefreshToken(): Promise<boolean> {
    return this.#refreshToken !== null;
  }

  async installAvailableUpdate(): Promise<void> {
    throw new Error('No verified update is ready to install.');
  }

  async listenForDeepLinks(): Promise<Unlisten> {
    return () => undefined;
  }

  async notify(): Promise<boolean> {
    return true;
  }

  async selectUploadFiles(): Promise<string[]> {
    return [];
  }

  async storeRefreshToken(refreshToken: string): Promise<void> {
    this.#refreshToken = refreshToken;
  }
}