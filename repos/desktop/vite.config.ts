import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';
import { readAppConfig } from './src/config/app-config';

export default defineConfig(({ mode }) => {
  readAppConfig(loadEnv(mode, process.cwd(), ''), mode);

  return {
    plugins: [react()],
    clearScreen: false,
    server: {
      host: '127.0.0.1',
      port: 1420,
      strictPort: true,
    },
    envPrefix: ['VITE_', 'TAURI_'],
  };
});