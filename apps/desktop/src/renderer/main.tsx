/**
 * React 19 入口
 *
 * 对应 06-详细设计文档 v4.2 §5.2 Desktop Renderer
 */
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App.js';

const rootEl = document.getElementById('root');
if (!rootEl) throw new Error('Root element #root not found');

createRoot(rootEl).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
