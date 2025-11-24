# Google OAuth Setup Guide 🔐

## ✅ Code Changes Complete
- Added `signInWithGoogle()` method to authContext
- Added Google login button to Auth component
- Auto-redirects to `/dashboard` after successful login

## 🔧 Supabase Configuration Required

You need to configure Google OAuth in your Supabase project:

### Step 1: Get Google OAuth Credentials

1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Create a new project or select existing one
3. Enable **Google+ API**
4. Go to **Credentials** → **Create Credentials** → **OAuth 2.0 Client ID**
5. Configure OAuth consent screen if needed
6. Application type: **Web application**
7. Add authorized redirect URI:
   ```
   https://<your-project-ref>.supabase.co/auth/v1/callback
   ```
   Example: `https://abcdefghijk.supabase.co/auth/v1/callback`

8. Copy the **Client ID** and **Client Secret**

### Step 2: Configure Supabase

1. Go to your [Supabase Dashboard](https://app.supabase.com)
2. Select your project
3. Go to **Authentication** → **Providers**
4. Find **Google** and click **Enable**
5. Paste your:
   - **Client ID** from Google
   - **Client Secret** from Google
6. Click **Save**

### Step 3: Test It!

```bash
npm run dev
```

Visit http://localhost:5173

Click **"Continue with Google"** → Should redirect to Google login → Then back to `/dashboard`

## 🎨 What the UI Looks Like Now

```
┌─────────────────────────────┐
│      Welcome Back           │
│                             │
│  Email: [input]             │
│  Password: [input]          │
│                             │
│  [ Sign In ]                │
│                             │
│  ───── OR ─────             │
│                             │
│  [🔵 Continue with Google]  │
│                             │
│  [ Don't have account? ]    │
└─────────────────────────────┘
```

## 🔒 How It Works

1. User clicks "Continue with Google"
2. Redirects to Google OAuth consent page
3. User approves
4. Google redirects back to your app with auth code
5. Supabase exchanges code for session
6. User lands on `/dashboard` with active session

## 📝 Local Development

For local development, add this redirect URI to Google Console:
```
http://localhost:54321/auth/v1/callback
```

Make sure your Supabase local instance is running if testing locally.

## ⚠️ Common Issues

**Issue**: "Redirect URI mismatch"
- **Fix**: Make sure the redirect URI in Google Console exactly matches your Supabase project URL

**Issue**: "Google provider not enabled"
- **Fix**: Enable Google provider in Supabase Dashboard → Authentication → Providers

**Issue**: After Google login, redirects to home instead of dashboard
- **Fix**: Already configured! We set `redirectTo: /dashboard` in the code

---

**All set!** Just configure Google OAuth in Supabase and you're ready to go. 🚀
