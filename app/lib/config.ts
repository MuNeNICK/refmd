import { env } from 'next-runtime-env';

// These are read at runtime on the server
const getServerConfig = () => {
  return {
    apiUrl: process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8888/api',
    socketUrl: process.env.NEXT_PUBLIC_SOCKET_URL || 'http://localhost:8888',
    siteUrl: process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000',
    signupEnabled: process.env.NEXT_PUBLIC_SIGNUP_ENABLED !== 'false',
  };
};

// Client-side configuration
const getClientConfig = () => {
  // Check if we're in the browser environment
  if (typeof window !== 'undefined') {
    
    const apiUrl = env('NEXT_PUBLIC_API_URL');
    const socketUrl = env('NEXT_PUBLIC_SOCKET_URL');
    const siteUrl = env('NEXT_PUBLIC_SITE_URL');
    const signupEnabled = env('NEXT_PUBLIC_SIGNUP_ENABLED');
    
    
    // If runtime env variables are available, use them
    if (apiUrl) {
      return {
        apiUrl,
        socketUrl: socketUrl || 'http://localhost:8888',
        siteUrl: siteUrl || 'http://localhost:3000',
        signupEnabled: signupEnabled !== 'false',
      };
    }
    
    // Otherwise, use dynamic host detection for localhost
    const host = window.location.hostname;
    const protocol = window.location.protocol;
    return {
      apiUrl: `${protocol}//${host}:8888/api`,
      socketUrl: `${protocol}//${host}:8888`,
      siteUrl: window.location.origin,
      signupEnabled: true,
    };
  }
  
  // Fallback for SSR - these will be replaced at runtime on the client
  return {
    apiUrl: process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8888/api',
    socketUrl: process.env.NEXT_PUBLIC_SOCKET_URL || 'http://localhost:8888',
    siteUrl: process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000',
    signupEnabled: process.env.NEXT_PUBLIC_SIGNUP_ENABLED !== 'false',
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

export function isSignupEnabled(): boolean {
  return getConfig().signupEnabled;
}