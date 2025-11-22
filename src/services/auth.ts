// Authentication service
import { supabase, supabaseAuth } from '../config/database.ts';
import { JWTService } from '../utils/jwt.ts';
import { AppError } from '../utils/errors.ts';
import { CookieService } from '../utils/cookies.ts';
import type { 
  User, 
  Student,
  Lecturer,
  LoginRequest, 
  RegisterRequest, 
  RefreshTokenRequest, 
  AuthResponse, 
  AuthTokens 
} from '../models/user.ts';
import type { Request, Response } from 'express';

export class AuthService {
  /**
   * Register a new user
   */
  static async register(data: RegisterRequest, req?: Request, res?: Response): Promise<AuthResponse> {
    try {
      // Check if user already exists in our database
      const { data: existingUser } = await supabase
        .from('users')
        .select('id, email')
        .eq('email', data.email)
        .single();

      if (existingUser) {
        throw new AppError('User with this email already exists', 409);
      }

      // Get frontend URL for email redirect
      // Supabase redirects with hash fragments (#access_token=...) which can only be read by frontend JavaScript
      const frontendUrl = process.env['FRONTEND_URL'] || 'http://localhost:5173';
      
      // Sign up user with Supabase Auth
      const { data: authData, error: authError } = await supabaseAuth.auth.signUp({
        email: data.email,
        password: data.password,
        options: {
          data: {
            role: data.role,
          },
          // Redirect to frontend callback route - frontend will handle the hash fragments
          // Make sure to add this URL in Supabase Dashboard → Authentication → URL Configuration → Redirect URLs
          emailRedirectTo: `${frontendUrl}/auth/callback`
        }
      });

      if (authError) {
        // Handle specific Supabase Auth errors
        if (authError.message.includes('already registered')) {
          throw new AppError('User with this email already exists', 409);
        }
        throw new AppError(`Registration failed: ${authError.message}`, 400);
      }

      if (!authData.user) {
        throw new AppError('Registration failed: No user data returned', 400);
      }

      // Check if email confirmation is required (when enabled in Supabase, user.email_confirmed_at will be null)
      // Also check if confirmation email was sent (session will be null if email confirmation required)
      const emailConfirmationRequired = !authData.user.email_confirmed_at && !authData.session;
      
      // Create user in our users table (create even if email not confirmed yet)
      const userData = {
        id: authData.user.id,
        email: authData.user.email!,
        role: data.role,
        created_at: new Date().toISOString(),
      };

      const { error: userInsertError } = await supabase
        .from('users')
        .insert([userData]);

      if (userInsertError) {
        console.error('Error creating user:', userInsertError);
        // Continue anyway as the auth user was created
      }

      // Create appropriate profile based on role
      let profile: Student | Lecturer;
      
      if (data.role === 'student') {
        const studentData = {
          id: crypto.randomUUID(),
          user_id: authData.user.id,
          first_name: data.first_name!,
          last_name: data.last_name!,
          class_year: null, // Will be filled later
          major: null, // Will be filled later
          bio: null,
          avatar_url: null,
          streak_count: 0,
          last_login: null,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        };

        const { error: studentInsertError } = await supabase
          .from('students')
          .insert([studentData]);

        if (studentInsertError) {
          console.error('Error creating student profile:', studentInsertError);
        }

        profile = studentData;
      } else {
        const lecturerData = {
          id: crypto.randomUUID(),
          user_id: authData.user.id,
          first_name: data.first_name!,
          last_name: data.last_name!,
          bio: null,
          avatar_url: null,
          classes_teaching: [], // Will be filled later
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        };

        const { error: lecturerInsertError } = await supabase
          .from('lecturers')
          .insert([lecturerData]);

        if (lecturerInsertError) {
          console.error('Error creating lecturer profile:', lecturerInsertError);
        }

        profile = lecturerData;
      }

      // If email confirmation is required, return response without tokens
      if (emailConfirmationRequired) {
        return {
          success: true,
          message: 'Registration successful! Please check your email to confirm your account before logging in.',
          data: {
            email: authData.user.email,
            email_confirmed: false,
            requires_email_confirmation: true,
          } as any,
        };
      }

      // Email already confirmed (or email confirmation disabled) - proceed with normal registration
      // Generate tokens
      const user: User = {
        id: authData.user.id,
        email: authData.user.email!,
        role: data.role,
        is_active: true,
        created_at: userData.created_at,
      };

      const tokens = JWTService.generateTokenPair(user);
      const authTokens: AuthTokens = {
        access_token: tokens.access_token,
        refresh_token: tokens.refresh_token,
        expires_in: JWTService.getTokenExpirationTime(),
        token_type: 'Bearer',
      };

      // Set secure HTTP-only cookies if response object is provided
      if (res && req) {
        CookieService.setAuthCookies(req, res, tokens.access_token, tokens.refresh_token);
      }

      return {
        success: true,
        message: 'User registered successfully',
        data: {
          user,
          profile,
          // Don't send tokens in response body when using cookies
          ...(res ? {} : { tokens: authTokens }),
        },
      };
    } catch (error) {
      if (error instanceof AppError) {
        throw error;
      }
      throw new AppError('Registration failed', 500);
    }
  }

  /**
   * Login user
   */
  static async login(data: LoginRequest, req?: Request, res?: Response): Promise<AuthResponse> {
    try {
      // Authenticate with Supabase
      const { data: authData, error: authError } = await supabaseAuth.auth.signInWithPassword({
        email: data.email,
        password: data.password,
      });

      if (authError) {
        throw new AppError(`Login failed: ${authError.message}`, 401);
      }

      if (!authData.user) {
        throw new AppError('Login failed: No user data returned', 401);
      }

      // Get user data from our database
      const { data: userData, error: userError } = await supabase
        .from('users')
        .select('*')
        .eq('id', authData.user.id)
        .single();

      if (userError || !userData) {
        throw new AppError('User not found', 404);
      }

      // Get the appropriate profile based on role
      let profile: Student | Lecturer;
      
      if (userData.role === 'student') {
        const { data: studentData, error: studentError } = await supabase
          .from('students')
          .select('*')
          .eq('user_id', userData.id)
          .single();

        if (studentError || !studentData) {
          throw new AppError('Student profile not found', 404);
        }
        profile = studentData;
      } else {
        const { data: lecturerData, error: lecturerError } = await supabase
          .from('lecturers')
          .select('*')
          .eq('user_id', userData.id)
          .single();

        if (lecturerError || !lecturerData) {
          throw new AppError('Lecturer profile not found', 404);
        }
        profile = lecturerData;
      }

      // Generate tokens
      const tokens = JWTService.generateTokenPair(userData);
      const authTokens: AuthTokens = {
        access_token: tokens.access_token,
        refresh_token: tokens.refresh_token,
        expires_in: JWTService.getTokenExpirationTime(),
        token_type: 'Bearer',
      };

      // Set secure HTTP-only cookies if response object is provided
      if (res && req) {
        CookieService.setAuthCookies(req, res, tokens.access_token, tokens.refresh_token);
      }

      return {
        success: true,
        message: 'Login successful',
        data: {
          user: userData,
          profile,
          // TODO: Remove this after testing
          tokens: authTokens,
          // Don't send tokens in response body when using cookies
          ...(res ? {} : { tokens: authTokens }),
        },
      };
    } catch (error) {
      if (error instanceof AppError) {
        throw error;
      }
      throw new AppError('Login failed', 500);
    }
  }

  /**
   * Refresh access token
   */
  static async refreshToken(data: RefreshTokenRequest, req?: Request, res?: Response): Promise<AuthResponse> {
    try {
      // Verify refresh token
      const payload = JWTService.verifyRefreshToken(data.refresh_token);

      // Get user data
      const { data: userData, error: userError } = await supabase
        .from('users')
        .select('*')
        .eq('id', payload.sub)
        .single();

      if (userError || !userData) {
        throw new AppError('User not found', 404);
      }


      // Generate new tokens
      const tokens = JWTService.generateTokenPair(userData);
      const authTokens: AuthTokens = {
        access_token: tokens.access_token,
        refresh_token: tokens.refresh_token,
        expires_in: JWTService.getTokenExpirationTime(),
        token_type: 'Bearer',
      };

      // Get the appropriate profile based on role
      let profile: Student | Lecturer;
      
      if (userData.role === 'student') {
        const { data: studentData, error: studentError } = await supabase
          .from('students')
          .select('*')
          .eq('user_id', userData.id)
          .single();

        if (studentError || !studentData) {
          throw new AppError('Student profile not found', 404);
        }
        profile = studentData;
      } else {
        const { data: lecturerData, error: lecturerError } = await supabase
          .from('lecturers')
          .select('*')
          .eq('user_id', userData.id)
          .single();

        if (lecturerError || !lecturerData) {
          throw new AppError('Lecturer profile not found', 404);
        }
        profile = lecturerData;
      }

      // Set secure HTTP-only cookies if response object is provided
      if (res && req) {
        CookieService.setAuthCookies(req, res, tokens.access_token, tokens.refresh_token);
      }

      return {
        success: true,
        message: 'Token refreshed successfully',
        data: {
          user: userData,
          profile,
          // Don't send tokens in response body when using cookies
          ...(res ? {} : { tokens: authTokens }),
        },
      };
    } catch (error) {
      if (error instanceof AppError) {
        throw error;
      }
      throw new AppError('Token refresh failed', 401);
    }
  }

  /**
   * Get user by ID
   */
  static async getUserById(userId: string): Promise<User> {
    const { data: userData, error } = await supabase
      .from('users')
      .select('*')
      .eq('id', userId)
      .single();

    if (error || !userData) {
      throw new AppError('User not found', 404);
    }

    return userData;
  }

  /**
   * Logout user (invalidate refresh token)
   */
  static async logout(_userId: string, req?: Request, res?: Response): Promise<{ success: boolean; message: string }> {
    try {
      // Clear secure HTTP-only cookies if response object is provided
      if (res && req) {
        CookieService.clearAllAuthCookies(req, res);
      }

      // For now, we'll just return success
      // In a more sophisticated system, you might want to blacklist the token
      // or store it in a database table for invalidation
      return {
        success: true,
        message: 'Logged out successfully',
      };
    } catch (error) {
      throw new AppError('Logout failed', 500);
    }
  }
}
