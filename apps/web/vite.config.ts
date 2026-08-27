import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

import { devProxy } from './src/vite-proxy.js';

export default defineConfig({ plugins: [react()], server: { host: '127.0.0.1', port: 5173, strictPort: true, proxy: devProxy } });
