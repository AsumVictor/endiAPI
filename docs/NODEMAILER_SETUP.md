# Nodemailer Setup & Documentation

Complete guide for setting up and using the Nodemailer email service in this API server.

## Table of Contents

- [Installation](#installation)
- [Configuration](#configuration)
- [Usage](#usage)
- [Email Templates](#email-templates)
- [Supported Email Providers](#supported-email-providers)
- [Testing](#testing)
- [Troubleshooting](#troubleshooting)

## Installation

Nodemailer has been installed with the following packages:

```bash
npm install nodemailer
npm install --save-dev @types/nodemailer
```

## Configuration

### Environment Variables

Add the following variables to the `.env` file:

```bash
# Email Configuration (Nodemailer)
EMAIL_ENABLED=true

# Option 1: Use a predefined service (Gmail, SendGrid, Outlook, etc.)
EMAIL_SERVICE=Gmail

# Option 2: Use custom SMTP (leave EMAIL_SERVICE empty)
EMAIL_HOST=smtp.gmail.com
EMAIL_PORT=587
EMAIL_SECURE=false

# Email sender information
EMAIL_FROM_NAME=App Name
EMAIL_FROM_ADDRESS=noreply@domain.com

# Email authentication
EMAIL_AUTH_USER=email@gmail.com
EMAIL_AUTH_PASSWORD=app-password

# TLS Configuration
EMAIL_TLS_REJECT_UNAUTHORIZED=true
```

### Configuration Options

| Variable | Description | Default | Required |
|----------|-------------|---------|----------|
| `EMAIL_ENABLED` | Enable/disable email service | `false` | Yes |
| `EMAIL_SERVICE` | Predefined service name (Gmail, SendGrid, etc.) | - | Optional |
| `EMAIL_HOST` | SMTP server hostname | `smtp.gmail.com` | Required if no service |
| `EMAIL_PORT` | SMTP server port | `587` | Required if no service |
| `EMAIL_SECURE` | Use TLS/SSL (true for port 465) | `false` | Required if no service |
| `EMAIL_FROM_NAME` | Display name for sender | `API Server` | Yes |
| `EMAIL_FROM_ADDRESS` | Sender email address | - | Yes |
| `EMAIL_AUTH_USER` | Email/username for authentication | - | Yes |
| `EMAIL_AUTH_PASSWORD` | Password or app password | - | Yes |
| `EMAIL_TLS_REJECT_UNAUTHORIZED` | Reject unauthorized TLS certificates | `true` | Optional |

## Usage

### Basic Email Sending

```typescript
import { EmailService } from './utils/email.ts';

// Send a simple email
await EmailService.sendEmail({
  to: 'user@example.com',
  subject: 'Test Email',
  html: '<h1>Hello!</h1><p>This is a test email.</p>',
  text: 'Hello! This is a test email.', // Optional
});
```

### Send to Multiple Recipients

```typescript
await EmailService.sendEmail({
  to: ['user1@example.com', 'user2@example.com'],
  subject: 'Test Email',
  html: '<p>This email is sent to multiple recipients.</p>',
});
```

### With CC and BCC

```typescript
await EmailService.sendEmail({
  to: 'user@example.com',
  cc: 'cc@example.com',
  bcc: ['bcc1@example.com', 'bcc2@example.com'],
  subject: 'Test Email',
  html: '<p>Email with CC and BCC.</p>',
});
```

### With Attachments

```typescript
await EmailService.sendEmail({
  to: 'user@example.com',
  subject: 'Email with Attachment',
  html: '<p>Please find the attachment.</p>',
  attachments: [
    {
      filename: 'document.pdf',
      path: '/path/to/document.pdf',
    },
    {
      filename: 'image.png',
      content: Buffer.from('...'), // or use path
      contentType: 'image/png',
    },
  ],
});
```

## Email Templates

The EmailService supports two ways to send emails:

1. **Inline HTML** - Define HTML directly in code (for simple emails)
2. **Template Files** - Load HTML templates from `src/utils/email/templates/` (for complex, reusable emails)

### Using Template Files

Templates use placeholder variables in the format `{{variableName}}`:

```typescript
// Template file: src/utils/email/templates/my-template.html
// Contains: <h1>Hello {{name}}</h1>

import { loadEmailTemplate } from './utils/email/email/template-loader.ts';

const html = loadEmailTemplate('my-template', {
  name: 'John Doe',
  email: 'john@example.com'
});
```

### Available Template Methods

The EmailService includes built-in template methods:

### Welcome Email

```typescript
await EmailService.sendWelcomeEmail(
  'user@example.com',
  'John Doe'
);
```

### Password Reset Email

```typescript
const resetToken = 'reset-token';
const resetUrl = `${frontendUrl}/reset-password?token=${resetToken}`;

await EmailService.sendPasswordResetEmail(
  'user@example.com',
  resetUrl
);
```

### Verification Email

```typescript
const verificationUrl = `${frontendUrl}/verify-email?token=${token}`;

await EmailService.sendVerificationEmail(
  'user@example.com',
  verificationUrl
);
```

### Beta Confirmation Email (Template-based)

```typescript
await EmailService.sendBetaConfirmationEmail(
  'user@example.com',     // Recipient email
  'John Doe',             // User's name
  'user@example.com',     // Login email
  'temporary-password',   // Temporary password
  'https://app.example.com' // App URL (optional, defaults to FRONTEND_URL)
);
```

**Template Location:** `src/utils/email/templates/beta-confirmation.html`

This template includes:
- Professional branding
- Login credentials display
- Testing period information
- Call-to-action button
- Responsive design

See `src/utils/email/templates/README.md` for more details on creating custom templates.

### Custom HTML Email

```typescript
const htmlTemplate = `
  <!DOCTYPE html>
  <html>
  <head>
    <style>
      body { font-family: Arial, sans-serif; }
      .container { max-width: 600px; margin: 0 auto; padding: 20px; }
    </style>
  </head>
  <body>
    <div class="container">
      <h1>Custom Email</h1>
      <p>Custom content here.</p>
    </div>
  </body>
  </html>
`;

await EmailService.sendEmail({
  to: 'user@example.com',
  subject: 'Custom Email',
  html: htmlTemplate,
});
```

## Supported Email Providers

### Gmail

```bash
EMAIL_ENABLED=true
EMAIL_SERVICE=Gmail
EMAIL_FROM_NAME=App
EMAIL_FROM_ADDRESS=email@gmail.com
EMAIL_AUTH_USER=email@gmail.com
EMAIL_AUTH_PASSWORD=app-password  # Generate from Google Account settings
```

**Note:** Gmail requires an [App Password](https://support.google.com/accounts/answer/185833) for authentication.

### SendGrid

```bash
EMAIL_ENABLED=true
EMAIL_HOST=smtp.sendgrid.net
EMAIL_PORT=587
EMAIL_SECURE=false
EMAIL_FROM_NAME=App
EMAIL_FROM_ADDRESS=noreply@domain.com
EMAIL_AUTH_USER=apikey
EMAIL_AUTH_PASSWORD=sendgrid-api-key
```

### Outlook/Hotmail

```bash
EMAIL_ENABLED=true
EMAIL_SERVICE=Outlook
EMAIL_FROM_NAME=App
EMAIL_FROM_ADDRESS=email@outlook.com
EMAIL_AUTH_USER=email@outlook.com
EMAIL_AUTH_PASSWORD=password
```

### Custom SMTP

```bash
EMAIL_ENABLED=true
EMAIL_HOST=smtp.domain.com
EMAIL_PORT=587
EMAIL_SECURE=false
EMAIL_FROM_NAME=App
EMAIL_FROM_ADDRESS=noreply@domain.com
EMAIL_AUTH_USER=username
EMAIL_AUTH_PASSWORD=password
```

## Testing

### Verify Email Configuration

The email service is automatically initialized when the server starts. You can verify the configuration by checking the server logs:

```
✅ Email service initialized and verified successfully
```

If verification fails:

```
⚠️ Email service initialized but verification failed
```

### Send a Test Email

Create a test route or script:

```typescript
// In a route or script
import { EmailService } from './utils/email.ts';

try {
  await EmailService.sendEmail({
    to: 'test@example.com',
    subject: 'Test Email',
    html: '<h1>Test</h1><p>This is a test email.</p>',
  });
  console.log('Email sent successfully!');
} catch (error) {
  console.error('Failed to send email:', error);
}
```

### Using in Routes

Example: Send welcome email after registration

```typescript
import { EmailService } from '../utils/email.ts';

router.post('/register', async (req, res) => {
  // ... registration logic ...
  
  // Send welcome email
  try {
    await EmailService.sendWelcomeEmail(
      user.email,
      `${user.first_name} ${user.last_name}`
    );
  } catch (error) {
    console.error('Failed to send welcome email:', error);
    // Don't fail registration if email fails
  }
  
  res.json({ success: true, message: 'Registration successful' });
});
```

## Troubleshooting

### Email Not Sending

1. **Check if email is enabled:**
   ```bash
   EMAIL_ENABLED=true
   ```

2. **Verify credentials:**
   - Ensure `EMAIL_AUTH_USER` and `EMAIL_AUTH_PASSWORD` are correct
   - For Gmail, use an App Password, not the regular password

3. **Check port and security:**
   - Port 465 requires `EMAIL_SECURE=true`
   - Port 587 requires `EMAIL_SECURE=false`

4. **Check server logs:**
   - Look for initialization errors
   - Check for "Email service initialized and verified" message

### Gmail Authentication Issues

If using Gmail:

1. Enable 2-Factor Authentication
2. Generate an App Password:
   - Go to Google Account → Security
   - Enable 2-Step Verification
   - Generate App Password for "Mail"
   - Use this password in `EMAIL_AUTH_PASSWORD`

### "Connection Timeout" Error

- Check firewall settings
- Verify SMTP host and port
- Try different ports (587, 465, 25)
- Check if the hosting provider blocks SMTP ports

### "Authentication Failed" Error

- Verify username and password
- Check if account requires OAuth2 (use App Password instead)
- Ensure credentials are correctly set in `.env`

### TLS/SSL Errors

If you encounter TLS errors:

```bash
EMAIL_TLS_REJECT_UNAUTHORIZED=false  # Only for development!
```

**Warning:** Never use this in production unless you understand the security implications.

### Email Service Not Initialized

The email service is initialized automatically when the server starts. If you see warnings:

1. Check that `EMAIL_ENABLED=true` in the `.env` file
2. Ensure all required configuration variables are set
3. Check server startup logs for initialization errors

## API Reference

### EmailService Methods

#### `initialize()`
Initialize the email transporter. Called automatically on server startup.

#### `verify(): Promise<boolean>`
Verify the email transporter configuration. Returns `true` if verified.

#### `sendEmail(options: EmailOptions): Promise<void>`
Send an email with the provided options.

#### `sendWelcomeEmail(to: string, name: string): Promise<void>`
Send a welcome email template.

#### `sendPasswordResetEmail(to: string, resetUrl: string): Promise<void>`
Send a password reset email template.

#### `sendVerificationEmail(to: string, verificationUrl: string): Promise<void>`
Send an email verification template.

#### `close()`
Close the email transporter connection. Called automatically on server shutdown.

### EmailOptions Interface

```typescript
interface EmailOptions {
  to: string | string[];           // Recipient(s)
  subject: string;                  // Email subject
  html?: string;                    // HTML content
  text?: string;                    // Plain text content (optional)
  cc?: string | string[];           // CC recipient(s) (optional)
  bcc?: string | string[];          // BCC recipient(s) (optional)
  attachments?: Array<{             // Attachments (optional)
    filename: string;
    path?: string;
    content?: string | Buffer;
    contentType?: string;
  }>;
}
```

## Examples

### Example: Sending Email in a Route

```typescript
// src/routes/example.ts
import { Router } from 'express';
import { EmailService } from '../utils/email.ts';

const router = Router();

router.post('/send-email', async (req, res) => {
  try {
    const { to, subject, message } = req.body;

    await EmailService.sendEmail({
      to,
      subject,
      html: `<p>${message}</p>`,
    });

    res.json({ success: true, message: 'Email sent successfully' });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Failed to send email',
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

export default router;
```

### Example: Integration with Auth Service

```typescript
// In the auth service
import { EmailService } from '../utils/email.ts';

export class AuthService {
  static async register(data: RegisterRequest) {
    // ... registration logic ...
    
    // Send welcome email (non-blocking)
    EmailService.sendWelcomeEmail(
      data.email,
      `${data.first_name} ${data.last_name}`
    ).catch(error => {
      console.error('Failed to send welcome email:', error);
    });
    
    return { success: true, user };
  }
}
```

## Security Best Practices

1. **Never commit `.env` file** - Contains sensitive credentials
2. **Use App Passwords** - For Gmail and other providers that support it
3. **Enable TLS/SSL** - Use secure connections (port 465 with `EMAIL_SECURE=true`)
4. **Validate email addresses** - Before sending emails
5. **Rate limit** - Implement rate limiting on email-sending routes
6. **Error handling** - Never expose email credentials in error messages

## Additional Resources

- [Nodemailer Documentation](https://nodemailer.com/)
- [Nodemailer Transports](https://nodemailer.com/transports/)
- [Gmail App Passwords](https://support.google.com/accounts/answer/185833)
- [SendGrid SMTP Setup](https://docs.sendgrid.com/for-developers/sending-email/getting-started-smtp)

