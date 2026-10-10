import { defineConfig } from 'vite';

// Proxy decision-model and model-list calls to the local Ollama server,
// so the browser never makes a cross-origin request.
const OLLAMA = process.env.OLLAMA_HOST ?? 'http://localhost:11434';

export default defineConfig({
  server: {
    port: 5173,
    proxy: {
      '/v1': { target: OLLAMA, changeOrigin: true },
      '/api': { target: OLLAMA, changeOrigin: true },
    },
  },
});
