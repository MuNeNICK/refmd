'use client';

import { useEffect } from 'react';

export function YjsConfig() {
  useEffect(() => {
    // Configure console logging to suppress "event handler doesn't exist" warnings
    // while keeping other important errors
    const originalWarn = console.warn;
    const originalError = console.error;
    
    console.warn = (...args: unknown[]) => {
      // Filter out the specific yjs warning
      const message = args[0]?.toString() || '';
      if (message.includes('[yjs] Tried to remove event handler')) {
        return;
      }
      originalWarn.apply(console, args);
    };

    // Also filter console.error in case yjs uses that
    console.error = (...args: unknown[]) => {
      const message = args[0]?.toString() || '';
      if (message.includes('[yjs] Tried to remove event handler')) {
        return;
      }
      originalError.apply(console, args);
    };

    // Cleanup on unmount
    return () => {
      console.warn = originalWarn;
      console.error = originalError;
    };
  }, []);

  return null;
}