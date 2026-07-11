import { defineConfig } from 'vite';
import vue from '@vitejs/plugin-vue';
import { version } from './package.json';

export default defineConfig({
  plugins: [vue()],
  define: {
    __APP_VERSION__: JSON.stringify(version)
  },
  server: {
    // Requests arrive here proxied through Caddy with Host: qjfit — Vite's
    // dev-server host allowlist (added to guard against DNS rebinding)
    // rejects that Host header by default.
    allowedHosts: ['qjfit']
  }
});
