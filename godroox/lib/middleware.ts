import { NextRequest, NextResponse } from 'next/server';
import { getToken } from 'next-auth/jwt';

/**
 * Authentication middleware
 */
export async function authenticateRequest(
  request: NextRequest
): Promise<{ userId: string; userRole: string } | null> {
  const token = await getToken({
    req: request,
    secret: process.env.NEXTAUTH_SECRET,
  });

  if (!token || !token.sub) {
    return null;
  }

  return {
    userId: token.sub,
    userRole: token.role as string,
  };
}

/**
 * Rate limiting middleware (basic implementation)
 * In production, use Redis-based rate limiting
 */
export async function rateLimit(
  request: NextRequest,
  limit: number = 100,
  windowMs: number = 60000
): Promise<boolean> {
  // TODO: Implement Redis-based rate limiting
  // For now, return true (no rate limiting)
  return true;
}

/**
 * Validate API version
 */
export function validateApiVersion(version: string): boolean {
  const validVersions = ['v1'];
  return validVersions.includes(version);
}
