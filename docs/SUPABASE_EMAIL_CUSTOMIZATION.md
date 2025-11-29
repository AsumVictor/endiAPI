# Customizing Supabase Email Templates

## Where to Customize

**Supabase Dashboard** → **Authentication** → **Email Templates**

## Available Email Templates

1. **Confirm signup** - Email verification template
2. **Magic Link** - Passwordless login
3. **Change Email Address** - Email change confirmation
4. **Reset Password** - Password reset
5. **Invite user** - User invitation

## Customization Options

### 1. Email Subject
- Customize the subject line
- Use variables: `{{ .SiteURL }}`, `{{ .Email }}`, `{{ .Token }}`

### 2. Email From Name
- Go to: **Authentication** → **Settings** → **SMTP Settings**
- Set **From Email** and **From Name**

### 3. Email Template (HTML)

#### Default Template Variables:
```
{{ .SiteURL }}     - Site URL
{{ .Email }}       - User's email
{{ .Token }}       - Verification token
{{ .TokenHash }}   - Hashed token
{{ .RedirectTo }}  - Redirect URL after verification
{{ .ConfirmationURL }} - Full confirmation URL
```

#### Example Custom Template:

```html
<h2>Welcome!</h2>
<p>Hi there,</p>
<p>Please confirm the email address by clicking the link below:</p>
<p><a href="{{ .ConfirmationURL }}">Confirm Email</a></p>
<p>Or copy this link: {{ .ConfirmationURL }}</p>
<p>This link will expire in 1 hour.</p>
<p>If this wasn't requested, please ignore this email.</p>
```

## Step-by-Step Setup

### 1. Customize Email Templates

1. Go to **Supabase Dashboard**
2. Navigate to **Authentication** → **Email Templates**
3. Select template (e.g., **Confirm signup**)
4. Edit **Subject**:
   ```
   Confirm email for {{ .SiteURL }}
   ```
5. Edit **Body** (HTML):
   ```html
   <!DOCTYPE html>
   <html>
   <head>
     <style>
       body { font-family: Arial, sans-serif; }
       .button { 
         background-color: #007bff; 
         color: white; 
         padding: 10px 20px; 
         text-decoration: none; 
         border-radius: 5px; 
       }
     </style>
   </head>
   <body>
     <h2>Verify Email</h2>
     <p>Hello,</p>
     <p>Click the button below to verify the email address:</p>
     <a href="{{ .ConfirmationURL }}" class="button">Verify Email</a>
     <p>Or copy this link:</p>
     <p>{{ .ConfirmationURL }}</p>
     <p>This link expires in 1 hour.</p>
     <p>If this account wasn't created, please ignore this email.</p>
   </body>
   </html>
   ```
6. Click **Save**

### 2. Customize Email From Name/Sender

1. Go to **Authentication** → **Settings** → **SMTP Settings**
2. Set **From Email**: `noreply@yourdomain.com`
3. Set **From Name**: `App Name` or `Company Name`
4. Save changes

**Note:** If using custom SMTP, configure SMTP settings here.

### 3. Customize Redirect URL (in code)

Already configured in `src/services/auth.ts`:

```typescript
emailRedirectTo: `${frontendUrl}/auth/callback`
```

This is the URL users are redirected to after clicking the email link.

## Environment-Specific Templates

Different templates can be used for different environments by checking `{{ .SiteURL }}` in the template, but Supabase doesn't support environment-specific templates by default.

**Alternative:** Use different Supabase projects for dev/staging/production.

## Example Custom Templates

### Modern Template:
```html
<!DOCTYPE html>
<html>
<body style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
  <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); padding: 20px; text-align: center;">
    <h1 style="color: white; margin: 0;">Welcome!</h1>
  </div>
  <div style="padding: 30px;">
    <p>Hi there,</p>
    <p>Thanks for signing up! Please confirm the email address by clicking the button below:</p>
    <div style="text-align: center; margin: 30px 0;">
      <a href="{{ .ConfirmationURL }}" 
         style="background-color: #667eea; color: white; padding: 12px 30px; text-decoration: none; border-radius: 5px; display: inline-block;">
        Verify Email Address
      </a>
    </div>
    <p>Or copy and paste this link into the browser:</p>
    <p style="word-break: break-all; color: #666;">{{ .ConfirmationURL }}</p>
    <p><strong>This link will expire in 1 hour.</strong></p>
    <p>If this account wasn't created, please ignore this email.</p>
    <hr style="border: none; border-top: 1px solid #eee; margin: 30px 0;">
    <p style="color: #999; font-size: 12px;">This email was sent to {{ .Email }}</p>
  </div>
</body>
</html>
```

### Simple Template:
```html
<h2>Email Verification</h2>
<p>Click here to verify: <a href="{{ .ConfirmationURL }}">{{ .ConfirmationURL }}</a></p>
```

## Testing

1. Register a new user
2. Check email inbox
3. Verify email subject and content match the template
4. Click link and verify redirect works

## Important Notes

- **Template Variables**: Use `{{ .VariableName }}` syntax (Go template syntax)
- **HTML Supported**: Full HTML and CSS styling is supported
- **Redirect URL**: The `{{ .ConfirmationURL }}` includes the redirect URL set in code
- **Token Expiry**: Default is 1 hour (configurable in Supabase settings)
- **SMTP**: If using custom SMTP, configure in SMTP Settings

## Common Variables

- `{{ .SiteURL }}` - Supabase project URL or custom site URL
- `{{ .Email }}` - User's email address
- `{{ .Token }}` - Raw verification token (rarely needed)
- `{{ .ConfirmationURL }}` - Complete confirmation link (most common)
- `{{ .RedirectTo }}` - The redirect URL after verification

