import { NextRequest, NextResponse } from 'next/server'

export function middleware(request: NextRequest) {
  const { pathname, searchParams } = request.nextUrl
  
  console.log('Middleware: pathname=', pathname)
  console.log('Middleware: searchParams=', searchParams.toString())
  
  // Public routes that don't require authentication
  const publicRoutes = ['/auth/signin', '/auth/signup', '/']
  const isPublicRoute = publicRoutes.includes(pathname)
  
  // Check if this is a shared resource (document or scrap) with token
  const isSharedResource = (pathname.startsWith('/document/') || pathname.startsWith('/scrap/')) && searchParams.has('token')
  
  // Check if this is a public document route
  const isPublicDocument = pathname.startsWith('/u/')
  
  console.log('Middleware: isSharedResource=', isSharedResource)
  console.log('Middleware: has token param=', searchParams.has('token'))
  console.log('Middleware: isPublicDocument=', isPublicDocument)
  
  // Get authentication token from cookies
  const token = request.cookies.get('auth-token')?.value
  
  console.log('Middleware: auth cookie present=', !!token)
  
  // If user is not authenticated and trying to access protected route
  // BUT allow access if it's a shared resource with token or public document
  if (!token && !isPublicRoute && !isSharedResource && !isPublicDocument) {
    console.log('Middleware: Redirecting to signin')
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