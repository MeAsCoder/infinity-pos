// src/main.jsx
import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import App from './App';
import { AuthProvider } from './context/AuthContext';
import { SyncProvider } from './context/SyncContext';
import { registerSW } from 'virtual:pwa-register';
import './index.css';

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <BrowserRouter>
      <AuthProvider>
        <SyncProvider>
          <App />
        </SyncProvider>
      </AuthProvider>
    </BrowserRouter>
  </React.StrictMode>
);

// PWA service worker registration.
// registerType is 'prompt' (in vite.config.js) rather than 'autoUpdate' —
// on a POS, auto-reloading the moment a new deploy goes live could wipe out
// whatever a bartender is mid-typing into an order. This asks first.
const updateSW = registerSW({
  onNeedRefresh() {
    // Simple version — a native confirm dialog. If you want this to match
    // the app's look, swap this block for setting some React state that
    // renders a small toast/banner with an "Update" button, and call
    // updateSW(true) from that button's onClick instead.
    if (window.confirm('A new version of the POS is available. Reload now?')) {
      updateSW(true);
    }
  },
  onOfflineReady() {
    console.log('Infinity POS is ready to work offline.');
  },
});