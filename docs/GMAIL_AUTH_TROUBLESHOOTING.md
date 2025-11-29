# Gmail Authentication Troubleshooting

## Error: "535-5.7.8 Username and Password not accepted"

This error occurs when Gmail rejects authentication credentials. Common causes and solutions:

### 1. Verify App Password Setup

**Important:** Use an App Password, not the regular Gmail password.

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
   - Use the **Gmail address** as the username
   - Use the **16-character app password** (not the regular password)
   - Remove any spaces from the app password

### 2. Configuration Check

Ensure the `.env` file has:

```bash
EMAIL_ENABLED=true
EMAIL_SERVICE=Gmail
EMAIL_HOST=smtp.gmail.com
EMAIL_PORT=587                    # or 465
EMAIL_SECURE=false                # false for 587, true for 465
EMAIL_FROM_NAME=App Name     # No angle brackets!
EMAIL_FROM_ADDRESS=email@gmail.com
EMAIL_AUTH_USER=email@gmail.com
EMAIL_AUTH_PASSWORD=16-char-app-password  # No spaces!
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
- Port 587 (STARTTLS) or 465 (SSL) based on the settings
- Proper TLS/SSL encryption
- App password authentication

### 5. Verify App Password

Double-check:
- ✅ 2-Step Verification is enabled
- ✅ App Password was generated for "Mail"
- ✅ Using the full 16-character password (no spaces)
- ✅ Using the Gmail address (not username) as EMAIL_AUTH_USER
- ✅ App Password hasn't been revoked

### 6. Alternative: Use OAuth2

If App Passwords don't work, consider using OAuth2:

```typescript
// This requires additional setup with OAuth2 tokens
this.transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    type: 'OAuth2',
    user: 'email@gmail.com',
    clientId: 'client-id',
    clientSecret: 'client-secret',
    refreshToken: 'refresh-token',
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

