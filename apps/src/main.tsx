import '@fontsource-variable/inter';
import './styles/index.css';
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { App } from './App.tsx';
import { AutoReplyRunner } from './screens/AutoReplyRunner.tsx';
import { SessionProvider } from './lib/session.tsx';
import { ToastProvider } from './ui/index.ts';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <SessionProvider>
      <ToastProvider>
        <App />
        <AutoReplyRunner />
      </ToastProvider>
    </SessionProvider>
  </StrictMode>,
);
