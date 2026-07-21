'use client';

import { useEffect } from 'react';

export function PwaRegister() {
  useEffect(() => {
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker
        .register('/sw.js', { updateViaCache: 'none' })
        .catch((err) => console.warn('PWA: Service Worker registration failed', err));
    }
  }, []);

  return null;
}
