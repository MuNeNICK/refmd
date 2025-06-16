import { NextRequest, NextResponse } from 'next/server'

export function middleware(request: NextRequest) {
  const { pathname, searchParams } = request.nextUrl
  
  // Public routes that don't require authentication
  const publicRoutes = ['/auth/signin', '/auth/signup', '/']
  const isPublicRoute = publicRoutes.includes(pathname)
  
  // Check if this is a shared document with token
  const isSharedDocument = pathname.startsWith('/document/') && searchParams.has('token')
  
  // Get authentication token from cookies
  const token = request.cookies.get('auth-token')?.value
  
  // If user is not authenticated and trying to access protected route
  // BUT allow access if it's a shared document with token
  if (!token && !isPublicRoute && !isSharedDocument) {
    const signInUrl = new URL('/auth/signin', request.url)
    return NextResponse.redirect(signInUrl)
  }
  
  // If user is authenticated and trying to access auth pages, redirect to dashboard
  if (token && (pathname === '/auth/signin' || pathname === '/auth/signup')) {
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