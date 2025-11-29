# Frontend Auth Callback Route - REQUIRED

## The Problem

Supabase redirects to: `http://localhost:5173/auth/callback#access_token=...` or `#error=...`

The `#` hash fragments are **NOT sent to the server** - only frontend JavaScript can read them!

## Solution: Create `/auth/callback` Route on Frontend

Create this route in the frontend application.

### React Example (with React Router v6):

```jsx
// src/pages/AuthCallback.jsx or src/routes/AuthCallback.jsx
import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';

export default function AuthCallback() {
  const navigate = useNavigate();

  useEffect(() => {
    // Read hash fragments from URL (e.g., #access_token=... or #error=...)
    const hash = window.location.hash.substring(1); // Remove the #
    const params = new URLSearchParams(hash);
    
    // Extract values from hash
    const accessToken = params.get('access_token');
    const refreshToken = params.get('refresh_token');
    const error = params.get('error');
    const errorDescription = params.get('error_description');
    const errorCode = params.get('error_code');
    
    console.log('Auth callback hash:', { accessToken, error, errorDescription, errorCode });
    
    if (error) {
      // Handle error case
      console.error('Email verification error:', error, errorDescription);
      
      // Redirect to login with error message
      const errorMsg = errorDescription || error;
      navigate(`/login?verified=false&error=${encodeURIComponent(errorMsg)}&error_code=${errorCode || ''}`);
      return;
    }
    
    if (accessToken) {
      // Success! Email verified
      console.log('Email verified successfully!');
      
      // If you're using Supabase client in frontend, the session is automatically set
      // If not, you might want to store the tokens
      
      // Redirect to login with success message
      navigate('/login?verified=true&message=Email verified successfully! You can now login.');
      return;
    }
    
    // No token and no error - something unexpected
    console.warn('No access token or error in callback');
    navigate('/login?verified=false&error=Verification failed - invalid callback');
  }, [navigate]);

  // Show loading while processing
  return (
    <div style={{ padding: '2rem', textAlign: 'center' }}>
      <h2>Verifying email...</h2>
      <p>Please wait while we confirm the email address.</p>
    </div>
  );
}
```

### Add Route to the Router:

```jsx
// src/App.jsx or src/router.jsx
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import AuthCallback from './pages/AuthCallback';

function App() {
  return (
    <BrowserRouter>
      <Routes>
        {/* ... other routes ... */}
        <Route path="/auth/callback" element={<AuthCallback />} />
        {/* ... other routes ... */}
      </Routes>
    </BrowserRouter>
  );
}
```

### Vue Example (with Vue Router):

```vue
<!-- src/views/AuthCallback.vue -->
<template>
  <div class="auth-callback">
    <h2>Verifying email...</h2>
    <p>Please wait while we confirm the email address.</p>
  </div>
</template>

<script setup>
import { onMounted } from 'vue';
import { useRouter } from 'vue-router';

const router = useRouter();

onMounted(() => {
  // Read hash fragments
  const hash = window.location.hash.substring(1);
  const params = new URLSearchParams(hash);
  
  const accessToken = params.get('access_token');
  const error = params.get('error');
  const errorDescription = params.get('error_description');
  const errorCode = params.get('error_code');
  
  if (error) {
    console.error('Verification error:', error, errorDescription);
    router.push(`/login?verified=false&error=${encodeURIComponent(errorDescription || error)}&error_code=${errorCode || ''}`);
    return;
  }
  
  if (accessToken) {
    console.log('Email verified successfully!');
    router.push('/login?verified=true&message=Email verified successfully!');
    return;
  }
  
  router.push('/login?verified=false&error=Verification failed');
});
</script>
```

### Add Route:

```javascript
// src/router/index.js
import { createRouter, createWebHistory } from 'vue-router';
import AuthCallback from '../views/AuthCallback.vue';

const routes = [
  // ... other routes ...
  {
    path: '/auth/callback',
    name: 'AuthCallback',
    component: AuthCallback
  },
  // ... other routes ...
];
```

## Why Token Expires

- **One-time use**: Each token can only be used once
- **Time limit**: Tokens expire after ~1 hour
- **Already used**: If you click the link twice, the second click fails

## Handle Token Expiry on Login Page

On the login page, check for errors:

```javascript
// In the Login component
useEffect(() => {
  const params = new URLSearchParams(window.location.search);
  const verified = params.get('verified');
  const error = params.get('error');
  const errorCode = params.get('error_code');
  
  if (verified === 'false') {
    if (errorCode === 'otp_expired') {
      // Show message: "Verification link expired. Please request a new one."
      showError('Verification link has expired. Please request a new verification email.');
    } else {
      showError(decodeURIComponent(error || 'Verification failed'));
    }
  } else if (verified === 'true') {
    showSuccess('Email verified successfully! You can now login.');
  }
}, []);
```

## Summary

1. ✅ **Backend is correct** - it sets `emailRedirectTo: http://localhost:5173/auth/callback`
2. ✅ **Supabase redirects correctly** - to the frontend
3. ❌ **Missing**: Frontend `/auth/callback` route to read hash fragments
4. ✅ **Solution**: Create the route above to handle the verification

