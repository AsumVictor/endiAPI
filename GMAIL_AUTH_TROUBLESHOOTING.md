# Gmail Authentication Troubleshooting

## Error: "535-5.7.8 Username and Password not accepted"

This error occurs when Gmail rejects your authentication credentials. Here are the most common causes and solutions:

### 1. Verify App Password Setup

**Important:** You MUST use an App Password, not your regular Gmail password.

#### Steps to Generate App Password:

1. **Enable 2-Step Verification** (Required):
   - Go to [Google Account Security](https://myaccount.google.com/security)
   - Under "Signing in to Google", click "2-Step Verification"
   - Follow the steps to enable it

2. **Generate App Password**:
   - Go to [App Passwords](https://myaccount.google.com/apppasswords)
   - Select "Mail" as the app
   - Select "Other (Custom name)" as the device
   - Enter "Nodemailer" or any name
   - Click "Generate"
   - Copy the 16-character password (no spaces)

3. **Use the App Password**:
   - Use your **Gmail address** as the username
   - Use the **16-character app password** (not your regular password)
   - Remove any spaces from the app password

### 2. Configuration Check

Make sure your `.env` has:

```bash
EMAIL_ENABLED=true
EMAIL_SERVICE=Gmail
EMAIL_HOST=smtp.gmail.com
EMAIL_PORT=587                    # or 465
EMAIL_SECURE=false                # false for 587, true for 465
EMAIL_FROM_NAME=Your App Name     # No angle brackets!
EMAIL_FROM_ADDRESS=your-email@gmail.com
EMAIL_AUTH_USER=your-email@gmail.com
EMAIL_AUTH_PASSWORD=your-16-char-app-password  # No spaces!
EMAIL_TLS_REJECT_UNAUTHORIZED=false
```

### 3. Common Issues

#### Issue: App Password Has Spaces
**Solution:** Remove all spaces from the app password

#### Issue: Wrong Port Configuration
**Try both:**
- Port **587** with `EMAIL_SECURE=false` (STARTTLS)
- Port **465** with `EMAIL_SECURE=true` (SSL)

#### Issue: "Less Secure Apps" (Deprecated)
**Solution:** This feature is deprecated. You MUST use App Passwords with 2-Step Verification.

#### Issue: Account Restrictions
**Check:**
- Account is not locked or suspended
- No unusual activity detected by Google
- Account has sufficient permissions

### 4. Test Configuration

The updated code now uses explicit SMTP configuration for Gmail, which is more reliable with app passwords. The configuration automatically uses:
- Port 587 (STARTTLS) or 465 (SSL) based on your settings
- Proper TLS/SSL encryption
- App password authentication

### 5. Verify App Password

Double-check:
- ✅ 2-Step Verification is enabled
- ✅ App Password was generated for "Mail"
- ✅ Using the full 16-character password (no spaces)
- ✅ Using your Gmail address (not username) as EMAIL_AUTH_USER
- ✅ App Password hasn't been revoked

### 6. Alternative: Use OAuth2

If App Passwords don't work, consider using OAuth2:

```typescript
// This requires additional setup with OAuth2 tokens
this.transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    type: 'OAuth2',
    user: 'your-email@gmail.com',
    clientId: 'your-client-id',
    clientSecret: 'your-client-secret',
    refreshToken: 'your-refresh-token',
  },
});
```

### 7. Debug Steps

1. **Test with minimal config:**
   ```bash
   EMAIL_PORT=587
   EMAIL_SECURE=false
   EMAIL_TLS_REJECT_UNAUTHORIZED=false
   ```

2. **Try port 465:**
   ```bash
   EMAIL_PORT=465
   EMAIL_SECURE=true
   ```

3. **Check logs:** Look for specific error codes in the error message

### 8. Error Codes

- **535-5.7.8**: Bad credentials (wrong password or not an app password)
- **534-5.7.9**: Application-specific password required
- **550-5.7.1**: Account doesn't have permission

### Quick Checklist

- [ ] 2-Step Verification enabled
- [ ] App Password generated
- [ ] Using 16-character app password (no spaces)
- [ ] Using correct Gmail email address
- [ ] Port configured correctly (587 or 465)
- [ ] Secure setting matches port (false for 587, true for 465)
- [ ] Account is active and not restricted

### Still Having Issues?

1. Generate a new App Password
2. Double-check all environment variables
3. Try restarting the server
4. Check Gmail account security settings
5. Verify no firewall is blocking SMTP ports

