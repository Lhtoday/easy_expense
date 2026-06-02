import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

const frontendPort = Number(process.env.FRONTEND_PORT ?? 5173);
const apiPort = process.env.API_PORT ?? 3000;

export default defineConfig({
  plugins: [react()],
  server: {
    port: frontendPort,
    proxy: {
      '/api': {
        target: `http://localhost:${apiPort}`,
        changeOrigin: true,
      },
    },
  },
});
