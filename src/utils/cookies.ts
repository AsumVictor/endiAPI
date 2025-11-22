// Secure cookie utilities for token management
import type { Request, Response } from 'express';
import config from '../config/index.ts';

export interface CookieOptions {
  httpOnly: boolean;
  secure: boolean;
  sameSite: 'strict' | 'lax' | 'none';
  maxAge?: number;
  domain?: string;
  path?: string;
}

export class CookieService {
  /**
   * Determine cookie options based on request and environment
   * iOS Safari requires SameSite=None with Secure=true for cross-site cookies
   */
  private static getCookieOptions(req: Request, maxAge?: number): CookieOptions {
    const isProduction = config.nodeEnv !== 'development';
    
    // Check if request is over HTTPS (accounting for proxies/load balancers)
    const isHttps = req.secure || 
                    req.headers['x-forwarded-proto'] === 'https' || 
                    req.protocol === 'https' ||
                    req.headers['x-forwarded-ssl'] === 'on';
    
    // Check if this is a localhost/development environment
    const isLocalhost = req.headers.host && 
                       (req.headers.host.includes('localhost') || 
                        req.headers.host.includes('127.0.0.1') ||
                        req.headers.host.startsWith('192.168.') ||
                        req.headers.host.startsWith('10.'));
    
    // For iOS Safari: use SameSite=None with Secure when HTTPS or in production
    // This is required for cross-site cookies to work on iOS
    // Only use lax/not-secure for localhost HTTP connections
   
const useSecureCookies = isProduction || (isHttps && !isLocalhost);
const sameSite: 'lax' | 'none' = useSecureCookies ? 'none' : 'lax';

// Final cookie settings
const options: CookieOptions = {
  httpOnly: true,
  secure: useSecureCookies,
  sameSite,
  path: '/',
};

    if (maxAge) {
      options.maxAge = maxAge;
    }

    // Optional: Set domain for subdomain scenarios (e.g., .example.com)
    // Only set if COOKIE_DOMAIN is explicitly configured
    const cookieDomain = process.env['COOKIE_DOMAIN'];
    if (cookieDomain) {
      options.domain = cookieDomain;
    }

    return options;
  }

  /**
   * Set access token cookie (15 minutes)
   */
  static setAccessTokenCookie(req: Request, res: Response, token: string): void {
    const options = this.getCookieOptions(
      req,
      3 * 24 * 60 * 60 * 1000 // 3 days (TODO: Change to 15 minutes)
    );
    res.cookie('access_token', token, options);
  }

  /**
   * Set refresh token cookie (7 days)
   */
  static setRefreshTokenCookie(req: Request, res: Response, token: string): void {
    const options = this.getCookieOptions(
      req,
      7 * 24 * 60 * 60 * 1000 // 7 days
    );
    res.cookie('refresh_token', token, options);
  }

  /**
   * Clear access token cookie (must use same options as set)
   */
  static clearAccessTokenCookie(req: Request, res: Response): void {
    const options = this.getCookieOptions(req);
    // Remove maxAge for clearCookie
    delete options.maxAge;
    res.clearCookie('access_token', options);
  }

  /**
   * Clear refresh token cookie (must use same options as set)
   */
  static clearRefreshTokenCookie(req: Request, res: Response): void {
    const options = this.getCookieOptions(req);
    // Remove maxAge for clearCookie
    delete options.maxAge;
    res.clearCookie('refresh_token', options);
  }

  /**
   * Clear all auth cookies
   */
  static clearAllAuthCookies(req: Request, res: Response): void {
    this.clearAccessTokenCookie(req, res);
    this.clearRefreshTokenCookie(req, res);
  }

  /**
   * Set secure cookies for both tokens
   */
  static setAuthCookies(req: Request, res: Response, accessToken: string, refreshToken: string): void {
    this.setAccessTokenCookie(req, res, accessToken);
    this.setRefreshTokenCookie(req, res, refreshToken);
  }
}
