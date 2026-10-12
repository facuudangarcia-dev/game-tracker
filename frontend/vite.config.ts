/// <reference types="vitest/config" />
import { fileURLToPath } from 'node:url';
import react from '@vitejs/plugin-react';
import { defineConfig, loadEnv } from 'vite';

// The single .env file lives at the repository root.
const envDir = fileURLToPath(new URL('..', import.meta.url));

export default defineConfig(({ mode }) => {
  // Empty prefix: read server-only variables too (they are NOT exposed to the client).
  const env = loadEnv(mode, envDir, '');

  return {
    plugins: [react()],
    envDir,
    server: {
      port: 5173,
      strictPort: true,
      proxy: {
        // Same-origin API calls in development, so HttpOnly cookies just work.
        '/api': {
          target: env.DEV_PROXY_TARGET || 'http://localhost:3000',
          changeOrigin: true,
        },
      },
    },
    test: {
      environment: 'jsdom',
      setupFiles: ['./src/test/setup.ts'],
      css: false,
      restoreMocks: true,
      // Generous limits: the full suite runs in parallel with typecheck and lint.
      testTimeout: 15_000,
      coverage: {
        include: ['src/**/*.{ts,tsx}'],
        exclude: ['src/main.tsx', 'src/test/**', 'src/**/*.test.{ts,tsx}'],
      },
    },
  };
});
