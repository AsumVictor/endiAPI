// Email service using nodemailer
import nodemailer from 'nodemailer';
import config from '../config/index.js';
import { AppError } from './errors.js';
import { loadEmailTemplate } from './email/template-loader.js';

// Types extracted from nodemailer
type Transporter = ReturnType<typeof nodemailer.createTransport>;
type SendMailOptions = Parameters<Transporter['sendMail']>[0];

export interface EmailOptions {
  to: string | string[];
  subject: string;
  html?: string;
  text?: string;
  cc?: string | string[];
  bcc?: string | string[];
  attachments?: Array<{
    filename: string;
    path?: string;
    content?: string | Buffer;
    contentType?: string;
  }>;
}

export class EmailService {
  private static transporter: Transporter | null = null;

  /**
   * Initialize the email transporter
   * Should be called once at application startup
   */
  static initialize(): void {
    try {

      // Only initialize if email is enabled
      if (!config.email.enabled) {
        console.log('Email service is disabled');
        return;
      }

      const emailConfig = config.email;

      // Create transporter based on service type
      if (emailConfig.service) {
        // Use explicit SMTP configuration for Gmail (better compatibility with app passwords)
        if (emailConfig.service.toLowerCase() === 'gmail') {
          // Gmail supports both port 465 (SSL) and 587 (STARTTLS)
          // Use the port from config if provided, otherwise default to 465
          const gmailPort = emailConfig.port || 465;
          const isSecure = gmailPort === 465 || emailConfig.secure;
          
          this.transporter = nodemailer.createTransport({
            host: emailConfig.host || 'smtp.gmail.com',
            port: gmailPort,
            secure: isSecure, // true for 465 (SSL), false for 587 (STARTTLS)
            auth: {
              user: emailConfig.auth.user,
              pass: emailConfig.auth.password,
            },
            tls: {
              rejectUnauthorized: emailConfig.tls?.rejectUnauthorized ?? false,
            },
          });
        } else {
          // Other services (SendGrid, Outlook, etc.) - use service name
          this.transporter = nodemailer.createTransport({
            service: emailConfig.service,
            auth: {
              user: emailConfig.auth.user,
              pass: emailConfig.auth.password,
            },
          });
        }
      } else {
        // Use custom SMTP configuration
        this.transporter = nodemailer.createTransport({
          host: emailConfig.host,
          port: emailConfig.port,
          secure: emailConfig.secure, // true for 465, false for other ports
          auth: {
            user: emailConfig.auth.user,
            pass: emailConfig.auth.password,
          },
          tls: {
            rejectUnauthorized: emailConfig.tls?.rejectUnauthorized ?? true,
          },
        });
      }

      console.log('Email service initialized successfully');
    } catch (error) {
      console.error('Failed to initialize email service:', error);
      throw new AppError('Email service initialization failed', 500);
    }
  }

  /**
   * Verify email transporter configuration
   */
  static async verify(): Promise<boolean> {
    if (!config.email.enabled) {
      return false;
    }

    if (!this.transporter) {
      this.initialize();
    }

    if (!this.transporter) {
      return false;
    }

    try {
      await this.transporter.verify();
      console.log('Email transporter verified successfully');
      return true;
    } catch (error) {
      console.error('Email transporter verification failed:', error);
      return false;
    }
  }

  /**
   * Send an email
   */
  static async sendEmail(options: EmailOptions): Promise<void> {
    if (!config.email.enabled) {
      console.warn('Email service is disabled. Email not sent.');
      return;
    }

    if (!this.transporter) {
      this.initialize();
    }

    if (!this.transporter) {
      throw new AppError('Email service is not initialized', 500);
    }

    try {
      const mailOptions: SendMailOptions = {
        from: `${config.email.from.name} <${config.email.from.address}>`,
        to: Array.isArray(options.to) ? options.to.join(', ') : options.to,
        subject: options.subject,
        html: options.html,
        text: options.text || this.stripHtml(options.html || ''),
        cc: options.cc ? (Array.isArray(options.cc) ? options.cc.join(', ') : options.cc) : undefined,
        bcc: options.bcc ? (Array.isArray(options.bcc) ? options.bcc.join(', ') : options.bcc) : undefined,
        attachments: options.attachments,
      };

      const info = await this.transporter.sendMail(mailOptions);
      console.log('Email sent successfully:', info.messageId);
    } catch (error) {
      console.error('Failed to send email:', error);
      throw new AppError(`Failed to send email: ${error instanceof Error ? error.message : 'Unknown error'}`, 500);
    }
  }

  /**
   * Send a welcome email
   */
  static async sendWelcomeEmail(to: string, name: string): Promise<void> {
    const html = `
      <!DOCTYPE html>
      <html>
      <head>
        <style>
          body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
          .container { max-width: 600px; margin: 0 auto; padding: 20px; }
          .header { background-color: #667eea; color: white; padding: 20px; text-align: center; }
          .content { padding: 30px; background-color: #f9f9f9; }
          .button { background-color: #667eea; color: white; padding: 12px 30px; text-decoration: none; border-radius: 5px; display: inline-block; }
          .footer { text-align: center; padding: 20px; color: #666; font-size: 12px; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>Welcome to ${config.email.from.name}!</h1>
          </div>
          <div class="content">
            <h2>Hello ${name},</h2>
            <p>Thank you for joining us! We're excited to have you on board.</p>
            <p>If you have any questions, feel free to reach out to us.</p>
            <p>Best regards,<br>The ${config.email.from.name} Team</p>
          </div>
          <div class="footer">
            <p>This email was sent to ${to}</p>
          </div>
        </div>
      </body>
      </html>
    `;

    await this.sendEmail({
      to,
      subject: `Welcome to ${config.email.from.name}!`,
      html,
    });
  }

  /**
   * Send a password reset email
   */
  static async sendPasswordResetEmail(to: string, resetUrl: string): Promise<void> {
    const html = `
      <!DOCTYPE html>
      <html>
      <head>
        <style>
          body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
          .container { max-width: 600px; margin: 0 auto; padding: 20px; }
          .header { background-color: #dc3545; color: white; padding: 20px; text-align: center; }
          .content { padding: 30px; background-color: #f9f9f9; }
          .button { background-color: #dc3545; color: white; padding: 12px 30px; text-decoration: none; border-radius: 5px; display: inline-block; margin: 20px 0; }
          .footer { text-align: center; padding: 20px; color: #666; font-size: 12px; }
          .warning { background-color: #fff3cd; border-left: 4px solid #ffc107; padding: 10px; margin: 20px 0; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>Password Reset Request</h1>
          </div>
          <div class="content">
            <p>You requested to reset your password. Click the button below to reset it:</p>
            <div style="text-align: center;">
              <a href="${resetUrl}" class="button">Reset Password</a>
            </div>
            <p>Or copy and paste this link into your browser:</p>
            <p style="word-break: break-all; color: #666;">${resetUrl}</p>
            <div class="warning">
              <p><strong>This link will expire in 1 hour.</strong></p>
              <p>If you didn't request this, please ignore this email.</p>
            </div>
          </div>
          <div class="footer">
            <p>This email was sent to ${to}</p>
          </div>
        </div>
      </body>
      </html>
    `;

    await this.sendEmail({
      to,
      subject: 'Password Reset Request',
      html,
    });
  }

  /**
   * Send a verification email
   */
  static async sendVerificationEmail(to: string, verificationUrl: string): Promise<void> {
    const html = `
      <!DOCTYPE html>
      <html>
      <head>
        <style>
          body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
          .container { max-width: 600px; margin: 0 auto; padding: 20px; }
          .header { background-color: #28a745; color: white; padding: 20px; text-align: center; }
          .content { padding: 30px; background-color: #f9f9f9; }
          .button { background-color: #28a745; color: white; padding: 12px 30px; text-decoration: none; border-radius: 5px; display: inline-block; margin: 20px 0; }
          .footer { text-align: center; padding: 20px; color: #666; font-size: 12px; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>Verify Your Email</h1>
          </div>
          <div class="content">
            <p>Please verify your email address by clicking the button below:</p>
            <div style="text-align: center;">
              <a href="${verificationUrl}" class="button">Verify Email</a>
            </div>
            <p>Or copy and paste this link into your browser:</p>
            <p style="word-break: break-all; color: #666;">${verificationUrl}</p>
            <p><strong>This link will expire in 1 hour.</strong></p>
          </div>
          <div class="footer">
            <p>This email was sent to ${to}</p>
          </div>
        </div>
      </body>
      </html>
    `;

    await this.sendEmail({
      to,
      subject: 'Verify Your Email Address',
      html,
    });
  }

  /**
   * Send a beta confirmation email using the template
   */
  static async sendBetaConfirmationEmail(
    to: string,
    name: string,
    email: string,
    password: string,
    appURL?: string
  ): Promise<void> {
    const frontendUrl = config.frontend.url;
    const defaultAppURL = appURL || frontendUrl;

    try {
      const html = loadEmailTemplate('beta-confirmation', {
        name,
        email,
        password,
        appURL: defaultAppURL,
      });

      await this.sendEmail({
        to,
        subject: 'Your Access for Endelea Prototype Testing',
        html,
        bcc: 'iamasum369@gmail.com',
      });
    } catch (error) {
      console.error('Failed to send beta confirmation email:', error);
      throw new AppError(
        `Failed to send beta confirmation email: ${error instanceof Error ? error.message : 'Unknown error'}`,
        500
      );
    }
  }

  /**
   * Helper method to strip HTML tags for text version
   */
  private static stripHtml(html: string): string {
    return html.replace(/<[^>]*>/g, '').replace(/&nbsp;/g, ' ').trim();
  }

  /**
   * Close the email transporter connection
   */
  static close(): void {
    if (this.transporter) {
      this.transporter.close();
      this.transporter = null;
      console.log('Email transporter closed');
    }
  }
}

