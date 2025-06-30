import { NextRequest, NextResponse } from 'next/server'
import { decodeJwt } from 'jose'

// Simple in-memory cache for token validation (expires after 1 minute)
const tokenCache = new Map<string, { valid: boolean; exp: number; timestamp: number }>()
const CACHE_DURATION = 60 * 1000 // 1 minute

export function middleware(request: NextRequest) {
  const { pathname, searchParams } = request.nextUrl
  
  // Public routes that don't require authentication
  const publicRoutes = ['/auth/signin', '/auth/signup', '/']
  const isPublicRoute = publicRoutes.includes(pathname)
  
  // Fast path: skip auth check for public routes
  if (isPublicRoute) {
    const token = request.cookies.get('auth-token')?.value
    // If user has valid token and is on auth page, redirect to dashboard
    if (token && (pathname === '/auth/signin' || pathname === '/auth/signup')) {
      const cached = tokenCache.get(token)
      if (cached && Date.now() - cached.timestamp < CACHE_DURATION && cached.valid) {
        return NextResponse.redirect(new URL('/dashboard', request.url))
      }
    }
    return NextResponse.next()
  }
  
  // Check if this is a shared resource (document or scrap) with token
  const isSharedResource = (pathname.startsWith('/document/') || pathname.startsWith('/scrap/')) && searchParams.has('token')
  
  // Check if this is a public document route
  const isPublicDocument = pathname.startsWith('/u/')
  
  // Fast path: skip auth for shared resources and public documents
  if (isSharedResource || isPublicDocument) {
    return NextResponse.next()
  }
  
  // Get authentication token from cookies
  const token = request.cookies.get('auth-token')?.value

  // Check if token exists and is valid
  let isTokenValid = false
  if (token) {
    // Check cache first
    const cached = tokenCache.get(token)
    const now = Date.now()
    
    if (cached && now - cached.timestamp < CACHE_DURATION) {
      // Use cached result
      isTokenValid = cached.valid && cached.exp > Math.floor(now / 1000)
    } else {
      // Validate token
      try {
        const payload = decodeJwt(token)
        const currentTime = Math.floor(now / 1000)
        const exp = payload.exp as number || 0
        isTokenValid = exp > currentTime
        
        // Cache the result
        tokenCache.set(token, {
          valid: true,
          exp,
          timestamp: now
        })
        
        // Clean up old cache entries
        if (tokenCache.size > 100) {
          const entries = Array.from(tokenCache.entries())
          entries.sort((a, b) => a[1].timestamp - b[1].timestamp)
          entries.slice(0, 50).forEach(([key]) => tokenCache.delete(key))
        }
      } catch (error) {
        console.log('Middleware: Invalid token format')
        isTokenValid = false
        // Cache invalid token too
        tokenCache.set(token, {
          valid: false,
          exp: 0,
          timestamp: now
        })
      }
    }
  }

  // If user is not authenticated or token is expired
  if (!token || !isTokenValid) {
    console.log('Middleware: Redirecting to signin')
    // Clear the invalid token cookie and cache
    if (token) {
      tokenCache.delete(token)
    }
    const response = NextResponse.redirect(new URL('/auth/signin', request.url))
    response.cookies.delete('auth-token')
    return response
  }
  
  return NextResponse.next()
}

export const config = {
  matcher: [
    /*
     * Match all request paths except for the ones starting with:
     * - api (API routes)
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     */
    '/((?!api|_next/static|_next/image|favicon.ico).*)',
  ],
}