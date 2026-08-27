export const devProxy = {
  '/api': 'http://127.0.0.1:3000',
  '/ws': {
    target: 'http://127.0.0.1:3000',
    changeOrigin: true,
  },
  '/socket.io': {
    target: 'http://127.0.0.1:3000',
    changeOrigin: true,
    ws: true,
  },
} as const;
