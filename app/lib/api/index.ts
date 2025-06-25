import { RefMDClient } from './client';
import type { ApiRequestOptions } from './client/core/ApiRequestOptions';
import { ApiError } from './client/core/ApiError';
import { CancelablePromise } from './client/core/CancelablePromise';
import { getApiUrl } from '../config';

let apiClient: RefMDClient | null = null;
let accessToken: string | null = null;
let refreshToken: string | null = null;

// Token storage keys
const ACCESS_TOKEN_KEY = 'refmd_access_token';
const REFRESH_TOKEN_KEY = 'refmd_refresh_token';

// Initialize tokens from localStorage
if (typeof window !== 'undefined') {
  accessToken = localStorage.getItem(ACCESS_TOKEN_KEY);
  refreshToken = localStorage.getItem(REFRESH_TOKEN_KEY);
  
  // If not in localStorage, try to get from cookies
  if (!accessToken) {
    const authCookie = document.cookie
      .split('; ')
      .find(row => row.startsWith('auth-token='));
    if (authCookie) {
      accessToken = authCookie.split('=')[1];
    }
  }
}

// Configure API client
export function getApiClient(): RefMDClient {
  if (!apiClient) {
    apiClient = createApiClient();
  }
  // Always update the BASE URL in case it changed
  apiClient.request.config.BASE = getApiUrl();
  return apiClient;
}

function createApiClient(): RefMDClient {
  const client = new RefMDClient({
    BASE: getApiUrl(),
    TOKEN: accessToken ? () => Promise.resolve(accessToken as string) : undefined,
    // Don't set default Content-Type here to allow FormData uploads to work properly
  });
  
  // Setup interceptors on the new client
  setupClientInterceptors(client);
  
  return client;
}

// Update tokens
export function setTokens(access: string, refresh: string | null) {
  accessToken = access;
  refreshToken = refresh;
  
  // Save to localStorage
  if (typeof window !== 'undefined') {
    localStorage.setItem(ACCESS_TOKEN_KEY, access);
    if (refresh) {
      localStorage.setItem(REFRESH_TOKEN_KEY, refresh);
    }
    
    // Also save to cookies for Server Components
    document.cookie = `auth-token=${access}; path=/; max-age=${60 * 60 * 24 * 7}; SameSite=Lax`;
  }
  
  // Recreate API client with new token to ensure it's properly configured
  apiClient = createApiClient();
}

// Clear tokens
export function clearTokens() {
  accessToken = null;
  refreshToken = null;
  
  // Remove from localStorage
  if (typeof window !== 'undefined') {
    localStorage.removeItem(ACCESS_TOKEN_KEY);
    localStorage.removeItem(REFRESH_TOKEN_KEY);
    
    // Also clear from cookies
    document.cookie = 'auth-token=; path=/; expires=Thu, 01 Jan 1970 00:00:00 UTC; SameSite=Lax';
  }
  
  // Recreate API client without token
  apiClient = createApiClient();
}

// Get current tokens
export function getTokens() {
  return {
    accessToken,
    refreshToken,
  };
}

// Refresh access token
export async function refreshAccessToken(): Promise<boolean> {
  if (!refreshToken) {
    return false;
  }
  
  try {
    // Use a basic client without interceptors to avoid recursion
    const client = new RefMDClient({
      BASE: getApiUrl(),
    });
    // Ensure the client uses the latest URL
    client.request.config.BASE = getApiUrl();
    
    const response = await client.authentication.refreshToken({
      refresh_token: refreshToken,
    });
    
    if (response.access_token) {
      setTokens(response.access_token, response.refresh_token || null);
      return true;
    }
  } catch (error) {
    console.error('Failed to refresh token:', error);
    clearTokens();
  }
  
  return false;
}

// Add request interceptor for automatic token refresh
let isRefreshing = false;
let refreshPromise: Promise<boolean> | null = null;

function setupClientInterceptors(client: RefMDClient) {
  // Override the request method to handle 401 errors
  const originalRequest = client.request.request.bind(client.request);
  
  client.request.request = <T>(options: ApiRequestOptions): CancelablePromise<T> => {
    return new CancelablePromise<T>((resolve, reject) => {
      const executeRequest = async () => {
        try {
          const result = await originalRequest<T>(options);
          resolve(result);
        } catch (error) {
          // Don't try to refresh for auth endpoints
          const isAuthEndpoint = options.url?.includes('/auth/') || false;
          
          if (error instanceof ApiError && error.status === 401 && refreshToken && !isAuthEndpoint) {
            
            // If already refreshing, wait for the existing refresh to complete
            if (isRefreshing) {
              if (refreshPromise) {
                const refreshed = await refreshPromise;
                if (refreshed) {
                  // Retry the original request with new token
                  const retryOptions = {
                    ...options,
                    headers: {
                      ...options.headers,
                      Authorization: `Bearer ${accessToken}`,
                    }
                  };
                  const retryResult = await originalRequest<T>(retryOptions);
                  resolve(retryResult);
                  return;
                }
              }
            } else {
              // Start refresh process
              isRefreshing = true;
              refreshPromise = refreshAccessToken();
              
              try {
                const refreshed = await refreshPromise;
                if (refreshed) {
                  // Retry the original request with new token
                  const retryOptions = {
                    ...options,
                    headers: {
                      ...options.headers,
                      Authorization: `Bearer ${accessToken}`,
                    }
                  };
                  const retryResult = await originalRequest<T>(retryOptions);
                  resolve(retryResult);
                  return;
                } else {
                }
              } finally {
                isRefreshing = false;
                refreshPromise = null;
              }
            }
          }
          
          // If we couldn't refresh the token and got a 401, redirect to signin
          // But don't redirect if we're using a share token or checking current user
          const isShareRequest = options.url?.includes('token=') || false;
          const isGetCurrentUser = options.url?.includes('/users/me') || false;
          // Also check if we're on a shared page (has token in URL)
          const isOnSharedPage = typeof window !== 'undefined' && window.location.search.includes('token=');
          
          if (error instanceof ApiError && error.status === 401 && !isAuthEndpoint && !isShareRequest && !isGetCurrentUser && !isOnSharedPage) {
            clearTokens();
            if (typeof window !== 'undefined') {
              // Dispatch custom event for auth context to handle
              window.dispatchEvent(new CustomEvent('auth:error', { detail: { error } }));
              // Don't redirect directly - let the auth context handle it
            }
          }
          
          reject(error);
        }
      };
      
      executeRequest();
    });
  };
}

// Create a public API client without authentication
export function getPublicApiClient(): RefMDClient {
  return new RefMDClient({
    BASE: getApiUrl(),
    TOKEN: undefined, // Explicitly set to undefined to ensure no auth
  });
}

export * from './client';