import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { App } from './app/app';
import { loadAppConfig } from './config/app-config';
import './styles.css';

loadAppConfig();

const root = document.getElementById('root');
if (!root) throw new Error('Application root was not found.');

createRoot(root).render(
  <StrictMode>
    <App />
  </StrictMode>,
);