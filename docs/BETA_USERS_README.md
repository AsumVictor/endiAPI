# Beta Users Creation Script

Script to create multiple beta users and send welcome emails with access credentials.

## Usage

### As a Script

1. **Edit the script** to add user data:
   ```typescript
   // In src/scripts/create-beta-users.ts
   const betaUsers: BetaUserData[] = [
     {
       first_name: 'John',
       last_name: 'Doe',
       email: 'john.doe@example.com',
       role: 'student',
       password: 'TempPassword123!',
     },
     {
       first_name: 'Jane',
       last_name: 'Smith',
       email: 'jane.smith@example.com',
       role: 'lecturer',
       password: 'TempPassword456!',
     },
   ];
   ```

2. **Run the script:**
   ```bash
   npm run create-beta-users
   # or
   tsx src/scripts/create-beta-users.ts
   ```

### Programmatically

Import and use in code:

```typescript
import { createBetaUsers, createBetaUser } from './scripts/create-beta-users.ts';

// Create a single user
const result = await createBetaUser({
  first_name: 'John',
  last_name: 'Doe',
  email: 'john.doe@example.com',
  role: 'student',
  password: 'TempPassword123!',
});

// Create multiple users
const users = [
  {
    first_name: 'John',
    last_name: 'Doe',
    email: 'john.doe@example.com',
    role: 'student',
    password: 'TempPassword123!',
  },
  {
    first_name: 'Jane',
    last_name: 'Smith',
    email: 'jane.smith@example.com',
    role: 'lecturer',
    password: 'TempPassword456!',
  },
];

const results = await createBetaUsers(users, {
  continueOnError: true,      // Continue even if one fails
  sendEmails: true,            // Send welcome emails
  delayBetweenUsers: 1000,     // 1 second delay between users
});
```

## User Data Interface

```typescript
interface BetaUserData {
  first_name: string;
  last_name: string;
  email: string;
  role: 'student' | 'lecturer' | 'admin';
  password: string;
}
```

## Options

When using `createBetaUsers()`:

```typescript
{
  continueOnError?: boolean;      // Continue processing even if one fails (default: true)
  sendEmails?: boolean;            // Whether to send emails (default: true)
  delayBetweenUsers?: number;      // Delay in ms between users (default: 1000)
}
```

## Result Interface

Each user creation returns:

```typescript
interface CreateUserResult {
  email: string;
  success: boolean;
  message: string;
  userId?: string;
  emailSent?: boolean;
  error?: string;
}
```

## Email Template

The script uses the `beta-confirmation.html` template located at:
`src/utils/email/templates/beta-confirmation.html`

**Email Subject:** "Access for Endelea Prototype Testing"

The email includes:
- User's name
- Login credentials (email and password)
- App URL
- Testing period information
- Instructions

## Environment Variables

Set these in the `.env` file:

```bash
# Email Configuration
EMAIL_ENABLED=true
EMAIL_SERVICE=Gmail  # or the SMTP provider
EMAIL_FROM_NAME=CodeEndelea
EMAIL_FROM_ADDRESS=noreply@codeendelea.com
EMAIL_AUTH_USER=email@gmail.com
EMAIL_AUTH_PASSWORD=app-password

# Frontend URL (for app link in email)
FRONTEND_URL=https://app.codeendelea.com
```

## Features

- ✅ Batch user creation
- ✅ Automatic email sending with beta confirmation template
- ✅ Error handling with detailed results
- ✅ Continue on error option
- ✅ Rate limiting protection (configurable delay)
- ✅ Detailed logging
- ✅ Summary report after batch completion

## Example Output

```
[INFO] Starting batch creation of 2 beta users...
[INFO] Processing user 1/2: john.doe@example.com
[INFO] Creating user: john.doe@example.com
[INFO] ✓ User created and email sent: john.doe@example.com
[INFO] Processing user 2/2: jane.smith@example.com
[INFO] Creating user: jane.smith@example.com
[INFO] ✓ User created and email sent: jane.smith@example.com

=== Batch Creation Summary ===
Total users: 2
✓ Successful: 2
✗ Failed: 0
📧 Emails sent: 2
⚠️  Emails failed: 0
=============================
```

## Error Handling

- If a user already exists, the script will log an error and continue (if `continueOnError: true`)
- If email sending fails, the user is still created, but the error is logged
- All errors are captured in the result array with detailed messages

## Notes

- Users are created sequentially to avoid rate limits
- Email service must be enabled and configured
- The script requires database and email service to be accessible
- Passwords should be strong and unique for each user
- Consider using environment variables for sensitive data instead of hardcoding

