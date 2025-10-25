// Secure cookie utilities for token management
import type { Response } from 'express';
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
  private static readonly DEFAULT_OPTIONS: CookieOptions = {
    httpOnly: true,
    secure: config.nodeEnv === 'production', // Only secure in production
    sameSite: 'strict',
    path: '/',
  };

  /**
   * Set access token cookie (15 minutes)
   */
  static setAccessTokenCookie(res: Response, token: string): void {
    const options = {
      ...this.DEFAULT_OPTIONS,
      maxAge: 15 * 60 * 1000, // 15 minutes
      name: 'access_token',
    };

    res.cookie('access_token', token, options);
  }

  /**
   * Set refresh token cookie (7 days)
   */
  static setRefreshTokenCookie(res: Response, token: string): void {
    const options = {
      ...this.DEFAULT_OPTIONS,
      maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
      name: 'refresh_token',
    };

    res.cookie('refresh_token', token, options);
  }

  /**
   * Clear access token cookie
   */
  static clearAccessTokenCookie(res: Response): void {
    res.clearCookie('access_token', {
      ...this.DEFAULT_OPTIONS,
      maxAge: 0,
    });
  }

  /**
   * Clear refresh token cookie
   */
  static clearRefreshTokenCookie(res: Response): void {
    res.clearCookie('refresh_token', {
      ...this.DEFAULT_OPTIONS,
      maxAge: 0,
    });
  }

  /**
   * Clear all auth cookies
   */
  static clearAllAuthCookies(res: Response): void {
    this.clearAccessTokenCookie(res);
    this.clearRefreshTokenCookie(res);
  }

  /**
   * Set secure cookies for both tokens
   */
  static setAuthCookies(res: Response, accessToken: string, refreshToken: string): void {
    this.setAccessTokenCookie(res, accessToken);
    this.setRefreshTokenCookie(res, refreshToken);
  }
}
