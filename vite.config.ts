import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import {defineConfig} from 'vite';

export default defineConfig(() => {
  const allowedHosts = [
    'localhost',
    '127.0.0.1',
    '10.102.151.184',
    '172.236.21.180',
    'soc-cmdb.development.local',
    'soc-cmdb.cybersamurai.co.uk',
    ...(process.env.VITE_ALLOWED_HOSTS || '')
      .split(',')
      .map(host => host.trim())
      .filter(Boolean),
  ];

  return {
    plugins: [react(), tailwindcss()],
    resolve: {
      alias: {
        '@': path.resolve(__dirname, '.'),
      },
    },
    server: {
      // Allow the production hostnames and any extra hosts supplied through
      // VITE_ALLOWED_HOSTS (comma-separated, no scheme).
      allowedHosts,
      headers: {
        'Cross-Origin-Opener-Policy': 'same-origin',
        'Cross-Origin-Resource-Policy': 'cross-origin',
      },
      // HMR can be disabled with DISABLE_HMR for constrained environments.
      // Do not modify—file watching is disabled to prevent flickering during agent edits.
      hmr: process.env.DISABLE_HMR !== 'true',
      // Disable file watching when DISABLE_HMR is true to save CPU during agent edits.
      watch: process.env.DISABLE_HMR === 'true' ? null : {},
      // Never serve server-side files or the credential database during dev.
      fs: {
        deny: [
          '**/data/**',
          '**/server.ts',
          '**/auth.ts',
          '**/package.json',
          '**/bun.lock',
          '**/.env*',
        ],
      },
    },
  };
});
