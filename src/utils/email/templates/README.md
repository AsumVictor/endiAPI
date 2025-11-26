# Email Templates

This folder contains HTML email templates used by the EmailService.

## Template Format

Templates use placeholder variables in the format `{{variableName}}` which are replaced with actual values when rendering.

### Example

Template:
```html
<h1>Hello {{name}}</h1>
<p>Your email is {{email}}</p>
```

Will be rendered with:
```typescript
{
  name: "John Doe",
  email: "john@example.com"
}
```

Result:
```html
<h1>Hello John Doe</h1>
<p>Your email is john@example.com</p>
```

## Available Templates

### beta-confirmation.html

Beta confirmation email template for new beta testers.

**Required Variables:**
- `name` - User's name
- `email` - User's email address
- `password` - Temporary password for the user
- `appURL` - URL to the application (optional, defaults to FRONTEND_URL)

**Usage:**
```typescript
import { EmailService } from '../email.ts';

await EmailService.sendBetaConfirmationEmail(
  'user@example.com',
  'John Doe',
  'user@example.com',
  'temporary-password-123',
  'https://app.example.com' // optional
);
```

## Adding New Templates

1. Create a new HTML file in this folder (e.g., `my-template.html`)
2. Use `{{variableName}}` placeholders for dynamic content
3. Add a method to `EmailService` that uses `loadEmailTemplate()`
4. Update this README with the new template details

### Example: Adding a New Template

1. **Create template file:** `src/utils/email/templates/my-template.html`
   ```html
   <html>
   <body>
     <h1>Hello {{name}}</h1>
     <p>Message: {{message}}</p>
   </body>
   </html>
   ```

2. **Add method to EmailService:**
   ```typescript
   static async sendMyTemplateEmail(
     to: string,
     name: string,
     message: string
   ): Promise<void> {
     const html = loadEmailTemplate('my-template', {
       name,
       message,
     });

     await this.sendEmail({
       to,
       subject: 'My Template Email',
       html,
     });
   }
   ```

3. **Use the template:**
   ```typescript
   await EmailService.sendMyTemplateEmail(
     'user@example.com',
     'John',
     'This is a test message'
   );
   ```

## Template Best Practices

1. **Use inline CSS** - Email clients have limited CSS support
2. **Test responsiveness** - Use media queries for mobile devices
3. **Include plain text fallback** - EmailService will auto-generate, but you can provide custom text
4. **Keep images hosted** - Use absolute URLs for images (e.g., from Supabase storage)
5. **Test across clients** - Test in Gmail, Outlook, Apple Mail, etc.
6. **Avoid JavaScript** - Most email clients strip JavaScript
7. **Use table layouts** - Better compatibility than flexbox/grid

## Template Variables

All variables are optional - if a variable is not provided, the placeholder will remain in the template.

Variable names are case-sensitive: `{{Name}}` and `{{name}}` are different.

## Notes

- Templates are loaded at runtime from the filesystem
- Changes to templates require a server restart
- Template paths are resolved relative to this folder

