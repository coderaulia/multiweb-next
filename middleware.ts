import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

import { CSRF_COOKIE_NAME } from '@/services/securityConstants';

// ---------------------------------------------------------------------------
// Security headers
// ---------------------------------------------------------------------------

const contentSecurityPolicyBase = [
  "default-src 'self'",
  "base-uri 'self'",
  "form-action 'self'",
  "frame-ancestors 'none'",
  "object-src 'none'",
  "script-src 'self' 'nonce-REPLACE_ME_NONCE'",
  "script-src-attr 'none'",
  "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
  "img-src 'self' data: blob: https:",
  "font-src 'self' https://fonts.gstatic.com data:",
  "connect-src 'self' https:",
  "frame-src 'none'",
  "worker-src 'self' blob:",
  'upgrade-insecure-requests'
];

function generateNonce() {
  try {
    return crypto.randomUUID();
  } catch {
    return `${Date.now()}-${Math.random().toString(16).slice(2)}`;
  }
}

function generateCsrfToken() {
  try {
    return crypto.randomUUID();
  } catch {
    return `${Date.now()}-${Math.random().toString(16).slice(2)}`;
  }
}

// ---------------------------------------------------------------------------
// Tenant routing
// ---------------------------------------------------------------------------

// Slugs that are reserved for platform-level routes and must never be treated
// as tenant slugs.
const RESERVED_SLUGS = new Set([
  'admin',
  'api',
  '_next',
  'static',
  'login',
  'signup',
  'dashboard',
  'app',
  'www',
  'mail',
  'assets',
  'media',
  'cdn',
  'docs'
]);

// Paths that bypass tenant resolution entirely.
function isInternalPath(pathname: string): boolean {
  return (
    pathname.startsWith('/admin') ||
    pathname.startsWith('/api') ||
    pathname.startsWith('/_next') ||
    pathname.startsWith('/static') ||
    pathname === '/favicon.ico' ||
    pathname === '/robots.txt' ||
    pathname === '/sitemap.xml'
  );
}

function getRootHost(): string {
  try {
    const url = process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000';
    return new URL(url).hostname.toLowerCase();
  } catch {
    return 'localhost';
  }
}

// ---------------------------------------------------------------------------
// Middleware
// ---------------------------------------------------------------------------

export async function middleware(request: NextRequest) {
  const nonce = generateNonce();
  const csp = contentSecurityPolicyBase
    .join('; ')
    .replace(/REPLACE_ME_NONCE/g, nonce);

  const pathname = request.nextUrl.pathname;

  // Skip tenant resolution for internal/admin/api paths
  if (isInternalPath(pathname)) {
    const response = NextResponse.next();
    applySecurityHeaders(response, csp, nonce, pathname);
    applyCsrfCookie(request, response);
    return response;
  }

  const host = (request.headers.get('host') || '').toLowerCase().split(':')[0];
  const rootHost = getRootHost();
  const isRootDomain = host === rootHost || host === 'localhost' || host === '127.0.0.1';

  if (isRootDomain) {
    // Path-based routing: first segment is the tenant slug
    // e.g. /acme/blog -> tenant slug = 'acme'
    const segments = pathname.split('/').filter(Boolean);
    const firstSegment = segments[0] || '';

    if (!firstSegment || RESERVED_SLUGS.has(firstSegment)) {
      // No slug or reserved slug - let Next.js handle it (404 or root page)
      const response = NextResponse.next();
      applySecurityHeaders(response, csp, nonce, pathname);
      applyCsrfCookie(request, response);
      return response;
    }

    // Rewrite to the (public)/[tenant] route group
    // /acme/blog/my-post -> /(public)/acme/blog/my-post (internal rewrite)
    const tenantSlug = firstSegment;
    const restPath = '/' + segments.slice(1).join('/');
    const rewriteUrl = request.nextUrl.clone();
    rewriteUrl.pathname = `/${tenantSlug}${restPath === '/' ? '' : restPath}`;

    const response = NextResponse.rewrite(rewriteUrl);
    response.headers.set('x-tenant-slug', tenantSlug);
    applySecurityHeaders(response, csp, nonce, pathname);
    applyCsrfCookie(request, response);
    return response;
  }

  // Custom domain routing: resolve tenant by host
  // We set x-tenant-host so the page can resolve the tenant from the DB.
  // The actual DB lookup happens in the page/layout, not here, to keep
  // middleware edge-compatible without a DB connection.
  const response = NextResponse.next();
  response.headers.set('x-tenant-host', host);
  applySecurityHeaders(response, csp, nonce, pathname);
  applyCsrfCookie(request, response);
  return response;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function applySecurityHeaders(
  response: NextResponse,
  csp: string,
  nonce: string,
  pathname: string
) {
  response.headers.set('Content-Security-Policy', csp);
  response.headers.set('x-nonce', nonce);
  response.headers.set('Referrer-Policy', 'strict-origin-when-cross-origin');
  response.headers.set('X-Frame-Options', 'DENY');
  response.headers.set('X-Content-Type-Options', 'nosniff');
  response.headers.set('X-XSS-Protection', '1; mode=block');
  response.headers.set('Permissions-Policy', 'camera=(), microphone=(), geolocation=(), payment=(), usb=()');
  response.headers.set('Cross-Origin-Opener-Policy', 'same-origin');
  response.headers.set('Cross-Origin-Resource-Policy', 'same-site');

  if (
    pathname.startsWith('/admin') ||
    pathname.startsWith('/api/admin') ||
    pathname.startsWith('/api/contact')
  ) {
    response.headers.set('Cache-Control', 'no-store');
  }

  if (process.env.NODE_ENV === 'production') {
    response.headers.set('Strict-Transport-Security', 'max-age=31536000; includeSubDomains; preload');
  }
}

function applyCsrfCookie(request: NextRequest, response: NextResponse) {
  const csrfToken = request.cookies.get(CSRF_COOKIE_NAME)?.value;
  if (!csrfToken) {
    response.cookies.set(CSRF_COOKIE_NAME, generateCsrfToken(), {
      httpOnly: false,
      sameSite: 'lax',
      secure: process.env.NODE_ENV === 'production',
      path: '/'
    });
  }
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)']
};
