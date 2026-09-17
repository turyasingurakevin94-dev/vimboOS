import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import 'virtual:ow-tokens.css';
import './app/base.css';
import { App } from './app/App.js';

const root = document.getElementById('root');
if (root === null) throw new Error('#root is missing from index.html');

createRoot(root).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
