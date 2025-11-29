# Email Verification Flow

## How It Works

1. **User Registers** → Backend calls Supabase `signUp()`
2. **Supabase Sends Email** → User receives confirmation email
3. **User Clicks Link** → Supabase verifies token server-side
4. **Supabase Redirects** → To the frontend with hash fragments:
   - Success: `http://localhost:5173/auth/callback#access_token=...&type=...`
   - Error: `http://localhost:5173/auth/callback#error=...&error_description=...`

## Why Hash Fragments (#)?

- **Security**: Hash fragments are never sent to the server
- **Frontend Only**: Only JavaScript in the browser can read them
- **Standard**: This is how OAuth/Supabase Auth works

## Frontend Route Required

Create the `/auth/callback` route on the frontend to handle these hash fragments.

### Example React Route (Vite/React Router):

```javascript
// src/routes/AuthCallback.jsx or src/pages/AuthCallback.jsx
import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';

export default function AuthCallback() {
  const navigate = useNavigate();

  useEffect(() => {
    // Parse hash fragments from URL
    const hash = window.location.hash.substring(1); // Remove the #
    const params = new URLSearchParams(hash);
    
    const accessToken = params.get('access_token');
    const refreshToken = params.get('refresh_token');
    const error = params.get('error');
    const errorDescription = params.get('error_description');
    
    if (error) {
      // Handle error - redirect to login with error message
      console.error('Verification error:', error, errorDescription);
      navigate(`/login?verified=false&error=${encodeURIComponent(errorDescription || error)}`);
      return;
    }
    
    if (accessToken) {
      // Email verified successfully!
      // If using Supabase client, the session is already set
      // Just redirect to login with success message
      console.log('Email verified successfully!');
      navigate('/login?verified=true&message=Email verified successfully! Login is now available.');
      return;
    }
    
    // No token or error - something went wrong
    navigate('/login?verified=false&error=Verification failed');
  }, [navigate]);

  return (
    <div>
      <p>Verifying email...</p>
    </div>
  );
}
```

### Example Vue Route:

```javascript
// src/views/AuthCallback.vue
<template>
  <div>
    <p>Verifying email...</p>
  </div>
</template>

<script setup>
import { onMounted } from 'vue';
import { useRouter } from 'vue-router';

const router = useRouter();

onMounted(() => {
  // Parse hash fragments
  const hash = window.location.hash.substring(1);
  const params = new URLSearchParams(hash);
  
  const accessToken = params.get('access_token');
  const error = params.get('error');
  const errorDescription = params.get('error_description');
  
  if (error) {
    router.push(`/login?verified=false&error=${encodeURIComponent(errorDescription || error)}`);
    return;
  }
  
  if (accessToken) {
    router.push('/login?verified=true&message=Email verified successfully!');
    return;
  }
  
  router.push('/login?verified=false&error=Verification failed');
});
</script>
```

## Error: Token Expired

**Why it happens:**
- Supabase email verification tokens are **one-time use** and expire quickly (usually 1 hour)
- Clicking the link twice causes the second click to fail
- If too much time passes, the token expires

**Solution:**
- User must click the link **once** within the expiration time
- If expired, they need to request a new verification email

## Configure Supabase Dashboard

1. Go to **Supabase Dashboard** → **Authentication** → **URL Configuration**
2. Under **Redirect URLs**, add:
   - Development: `http://localhost:5173/auth/callback`
   - Production: `https://domain.com/auth/callback`
3. Save the changes

## Testing

1. Register a new user
2. Check the email inbox
3. Click the confirmation link **once** within 1 hour
4. Should redirect to `/auth/callback` → Then to `/login` with success message

## Troubleshooting

- **Redirects to callback but shows error**: Token expired or already used
- **Redirects to wrong URL**: Check Supabase Dashboard redirect URL settings
- **Hash fragments not working**: Ensure `window.location.hash` is being read, not `window.location.search`

