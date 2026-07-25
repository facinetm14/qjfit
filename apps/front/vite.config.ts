import { defineConfig } from 'vite';
import vue from '@vitejs/plugin-vue';
import { version } from './package.json';

const codespaceHost =
  process.env.CODESPACE_NAME && process.env.GITHUB_CODESPACES_PORT_FORWARDING_DOMAIN
    ? `${process.env.CODESPACE_NAME}-5173.${process.env.GITHUB_CODESPACES_PORT_FORWARDING_DOMAIN}`
    : undefined;

export default defineConfig({
  plugins: [vue()],
  define: {
    __APP_VERSION__: JSON.stringify(version)
  },
  server: {
    allowedHosts: codespaceHost ? ['qjfit', codespaceHost] : ['qjfit'],
    proxy: {
      '/api': {
        target: process.env.VITE_API_URL ?? 'http://localhost:3000',
        changeOrigin: true
      }
    }
  }
});
