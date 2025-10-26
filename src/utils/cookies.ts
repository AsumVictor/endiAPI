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
    secure: config.nodeEnv === 'development' ? false : true, // Only secure in production
    sameSite: 'none',
    path: '/',
  };

  /**
   * Set access token cookie (15 minutes)
   */
  static setAccessTokenCookie(res: Response, token: string): void {
    const options = {
      httpOnly: true,
      secure: config.nodeEnv === 'production',
      sameSite: (config.nodeEnv === 'production' ? 'none' : 'lax') as 'strict' | 'lax' | 'none',
      // TODO: Change to 15 minutes
      maxAge: 3 * 24 * 60 * 60 * 1000, // 3 days
      path: '/',
    };

    res.cookie('access_token', token, options);
  }

  /**
   * Set refresh token cookie (7 days)
   */
  static setRefreshTokenCookie(res: Response, token: string): void {
    const options = {
      httpOnly: true,
      secure: config.nodeEnv === 'production',
      sameSite: (config.nodeEnv === 'production' ? 'none' : 'lax') as 'strict' | 'lax' | 'none',
      maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
      path: '/',
    };

    res.cookie('refresh_token', token, options);
  }

  /**
   * Clear access token cookie
   */
  static clearAccessTokenCookie(res: Response): void {
    const options = {
      httpOnly: true,
      secure: config.nodeEnv === 'production',
      sameSite: (config.nodeEnv === 'production' ? 'none' : 'lax') as 'strict' | 'lax' | 'none',
      path: '/',
    };
    res.clearCookie('access_token', options);
  }

  /**
   * Clear refresh token cookie
   */
  static clearRefreshTokenCookie(res: Response): void {
    const options = {
      httpOnly: true,
      secure: config.nodeEnv === 'production',
      sameSite: (config.nodeEnv === 'production' ? 'none' : 'lax') as 'strict' | 'lax' | 'none',
      path: '/',
    };
    res.clearCookie('refresh_token', options);
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
