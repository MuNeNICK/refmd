// Server-side environment variables (without NEXT_PUBLIC_ prefix)
// These are read at runtime on the server
const getServerConfig = () => {
  return {
    apiUrl: process.env.API_URL || 'http://localhost:8888/api',
    socketUrl: process.env.SOCKET_URL || 'http://localhost:8888',
    siteUrl: process.env.SITE_URL || 'http://localhost:3000',
  };
};

// Client-side configuration
const getClientConfig = () => {
  // If we have NEXT_PUBLIC_ variables, use them
  if (process.env.NEXT_PUBLIC_API_URL) {
    return {
      apiUrl: process.env.NEXT_PUBLIC_API_URL,
      socketUrl: process.env.NEXT_PUBLIC_SOCKET_URL || 'http://localhost:8888',
      siteUrl: process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000',
    };
  }
  
  // Otherwise, use dynamic host detection for localhost
  if (typeof window !== 'undefined') {
    const host = window.location.hostname;
    const protocol = window.location.protocol;
    return {
      apiUrl: `${protocol}//${host}:8888/api`,
      socketUrl: `${protocol}//${host}:8888`,
      siteUrl: window.location.origin,
    };
  }
  
  // Fallback for SSR
  return {
    apiUrl: 'http://localhost:8888/api',
    socketUrl: 'http://localhost:8888',
    siteUrl: 'http://localhost:3000',
  };
};

// Main config getter
export function getConfig() {
  // On server, use server config
  if (typeof window === 'undefined') {
    return getServerConfig();
  }
  // On client, use client config
  return getClientConfig();
}

export function getApiUrl(): string {
  return getConfig().apiUrl;
}

export function getSocketUrl(): string {
  return getConfig().socketUrl;
}

export function getSiteUrl(): string {
  return getConfig().siteUrl;
}