import { NextRequest, NextResponse } from 'next/server'
import { decodeJwt } from 'jose'

export function middleware(request: NextRequest) {
  const { pathname, searchParams } = request.nextUrl
  
  // Public routes that don't require authentication
  const publicRoutes = ['/auth/signin', '/auth/signup', '/']
  const isPublicRoute = publicRoutes.includes(pathname)
  
  // Check if this is a shared resource (document or scrap) with token
  const isSharedResource = (pathname.startsWith('/document/') || pathname.startsWith('/scrap/')) && searchParams.has('token')
  
  // Check if this is a public document route
  const isPublicDocument = pathname.startsWith('/u/')
  
  // Get authentication token from cookies
  const token = request.cookies.get('auth-token')?.value

  // Check if token exists and is valid
  let isTokenValid = false
  if (token) {
    try {
      const payload = decodeJwt(token)
      const currentTime = Math.floor(Date.now() / 1000)
      isTokenValid = payload.exp ? payload.exp > currentTime : false
    } catch (error) {
      console.log('Middleware: Invalid token format')
      isTokenValid = false
    }
  }

  // If user is not authenticated or token is expired and trying to access protected route
  // BUT allow access if it's a shared resource with token or public document
  if ((!token || !isTokenValid) && !isPublicRoute && !isSharedResource && !isPublicDocument) {
    console.log('Middleware: Redirecting to signin')
    // Clear the invalid token cookie
    const response = NextResponse.redirect(new URL('/auth/signin', request.url))
    response.cookies.delete('auth-token')
    return response
  }
  
  // If user is authenticated with valid token and trying to access auth pages, redirect to dashboard
  if (token && isTokenValid && (pathname === '/auth/signin' || pathname === '/auth/signup')) {
    const dashboardUrl = new URL('/dashboard', request.url)
    return NextResponse.redirect(dashboardUrl)
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