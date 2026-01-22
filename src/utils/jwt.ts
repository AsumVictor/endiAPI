// JWT utilities for token management
import jwt from 'jsonwebtoken';
import config from '../config/index.js';
import type { User } from '../models/user.js';

export interface JWTPayload {
  sub: string; // user id
  email: string;
  role: string;
  iat: number;
  exp: number;
}

export interface RefreshTokenPayload {
  sub: string; // user id
  token_type: 'refresh';
  iat: number;
  exp: number;
}

export class JWTService {
  // TODO: Change to 15 minutes
  private static readonly ACCESS_TOKEN_EXPIRES_IN = '2d'; // 15 minutes
  private static readonly REFRESH_TOKEN_EXPIRES_IN = '7d'; // 7 days

  /**
   * Generate access token
   */
  static generateAccessToken(user: User): string {
    const payload: Omit<JWTPayload, 'iat' | 'exp'> = {
      sub: user.id,
      email: user.email,
      role: user.role,
    };

    return jwt.sign(payload, config.jwt.secret, {
      expiresIn: this.ACCESS_TOKEN_EXPIRES_IN,
      issuer: 'codeendelea-lms',
      audience: 'codeendelea-lms-api',
    });
  }

  /**
   * Generate refresh token
   */
  static generateRefreshToken(userId: string): string {
    const payload: Omit<RefreshTokenPayload, 'iat' | 'exp'> = {
      sub: userId,
      token_type: 'refresh',
    };

    return jwt.sign(payload, config.jwt.secret, {
      expiresIn: this.REFRESH_TOKEN_EXPIRES_IN,
      issuer: 'codeendelea-lms',
      audience: 'codeendelea-lms-api',
    });
  }

  /**
   * Verify access token
   */
  static verifyAccessToken(token: string): JWTPayload {
    try {
      return jwt.verify(token, config.jwt.secret, {
        issuer: 'codeendelea-lms',
        audience: 'codeendelea-lms-api',
      }) as JWTPayload;
    } catch (error) {
      throw new Error('Invalid or expired access token');
    }
  }

  /**
   * Verify refresh token
   */
  static verifyRefreshToken(token: string): RefreshTokenPayload {
    try {
      const payload = jwt.verify(token, config.jwt.secret, {
        issuer: 'codeendelea-lms',
        audience: 'codeendelea-lms-api',
      }) as RefreshTokenPayload;

      if (payload.token_type !== 'refresh') {
        throw new Error('Invalid token type');
      }

      return payload;
    } catch (error) {
      throw new Error('Invalid or expired refresh token');
    }
  }

  /**
   * Generate token pair
   */
  static generateTokenPair(user: User): { access_token: string; refresh_token: string } {
    return {
      access_token: this.generateAccessToken(user),
      refresh_token: this.generateRefreshToken(user.id),
    };
  }

  /**
   * Get token expiration time
   */
  static getTokenExpirationTime(): number {
    const now = Math.floor(Date.now() / 1000);
    return now + (15 * 60); // 15 minutes from now
  }
}
