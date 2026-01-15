# Mobile App Setup Guide - Capacitor + iOS

This guide will help you test and deploy the Glyde mobile app using Capacitor.

## ✅ What Was Fixed

### 1. Google Authentication
- **Before**: Used web OAuth flow (opens browser, doesn't work well in mobile WebView)
- **After**: Uses native Capacitor Google Auth plugin on iOS/Android
- **Benefits**: Seamless native Google sign-in experience, no browser redirects

### 2. Backend URL Configuration
- **Before**: Hardcoded URL without documentation
- **After**: Environment-based configuration with platform detection
- **Benefits**: Easy switching between dev/staging/prod environments

## 🚀 Setup Instructions

### Step 1: Install Dependencies

```bash
cd apps/frontend
npm install
```

### Step 2: Configure Environment Variables

Edit `apps/frontend/.env` and set:

```bash
# Use your computer's local IP for iOS device testing
# Find it: Mac → System Settings → Network → IP Address
VITE_AGENT_SERVICE_URL=http://YOUR_LOCAL_IP:8000

# Example:
VITE_AGENT_SERVICE_URL=http://10.0.0.113:8000
```

**Important**:
- For iOS Simulator: Use `http://localhost:8000`
- For iOS Device: Use your computer's local network IP (e.g., `http://10.0.0.113:8000`)
- Both your phone and computer must be on the same WiFi network

### Step 3: Start the Backend

You have two options:

**Option A: Using Docker (Recommended)**

From the project root:

```bash
docker-compose up agent
```

This starts the backend container on port 8000.

**Option B: Direct Node.js (for development)**

```bash
cd apps/agents
npm run dev
```

**Verify backend is running:**
- Visit `http://localhost:8000/health` in your browser
- Or from your phone's browser: `http://YOUR_LOCAL_IP:8000/health`

### Step 4: Build the Frontend

```bash
cd apps/frontend
npm run build:mobile
```

This will:
1. Build the React app with Vite
2. Sync the build with Capacitor
3. Copy assets to the iOS project

### Step 5: Open in Xcode

```bash
npm run ios:open
```

This opens the project in Xcode.

### Step 6: Configure Signing

In Xcode:
1. Select the "App" target
2. Go to "Signing & Capabilities"
3. Select your Apple Developer team
4. Xcode will auto-generate a provisioning profile

### Step 7: Run on Device/Simulator

**For Simulator:**
1. Select a simulator from the device dropdown (e.g., "iPhone 15 Pro")
2. Click the Play button or press `Cmd+R`

**For Physical Device:**
1. Connect your iPhone via USB
2. Select your device from the device dropdown
3. Click the Play button
4. First time: Go to Settings → General → Device Management → Trust developer

## 🧪 Testing the Authentication Flow

### Test 1: Google Sign-In (Native)

1. Launch the app
2. Tap "Continue with Google"
3. **Expected**: Native iOS Google sign-in sheet appears (not a browser)
4. Select your Google account
5. Grant permissions
6. **Expected**: Redirects to `/calendar` page

### Test 2: Email/Password Sign-In

1. Launch the app
2. Enter email and password
3. Tap "Sign In"
4. **Expected**: Redirects to `/calendar` page

### Test 3: Backend Connection

1. After signing in, navigate to the Calendar page
2. Try creating a new event
3. **Expected**: Event saves successfully
4. Check your backend logs for API calls

### Test 4: Sign Out

1. Navigate to Profile page
2. Tap "Sign Out"
3. **Expected**:
   - Redirects to login page
   - Both Supabase AND Google Auth sessions cleared

## 🐛 Troubleshooting

### Google Sign-In Fails

**Error**: "Failed to get Google ID token"

**Solutions**:
1. Check that `VITE_GOOGLE_CLIENT_ID` is set in `.env`
2. Verify the client ID matches your Google Cloud Console project
3. Ensure iOS URL scheme is configured in `Info.plist` (should already be set)
4. Check Xcode console for detailed error messages

### Backend Connection Fails

**Error**: Network request failed or timeout

**Solutions**:
1. **Check backend is running**: Visit `http://YOUR_IP:8000/health` in a browser
2. **Verify IP address**: Run `ifconfig` (Mac/Linux) or `ipconfig` (Windows) to confirm your local IP
3. **Same network**: Ensure phone and computer are on the same WiFi
4. **Firewall**: Temporarily disable firewall or allow port 8000
5. **Backend URL**: Check `.env` has correct `VITE_AGENT_SERVICE_URL`
6. **Rebuild**: After changing `.env`, run `npm run build:mobile` again

### App Won't Install on Device

**Error**: "Unable to install" or signing errors

**Solutions**:
1. In Xcode, select your Apple Developer team under Signing & Capabilities
2. Change Bundle Identifier to something unique (e.g., `com.yourname.glyde`)
3. Connect device and trust the computer
4. Device must have Developer Mode enabled (Settings → Privacy & Security → Developer Mode)

### OAuth Redirect Issues (Web Testing)

**Note**: The native Google Auth won't work in web browsers. The app will fall back to web OAuth flow automatically.

For web testing:
1. Run `npm run dev` (not `build:mobile`)
2. Google OAuth will open in a new tab (expected behavior)

## 📱 Platform Detection

The app automatically detects the platform:

```typescript
import { Capacitor } from '@capacitor/core'

if (Capacitor.isNativePlatform()) {
  // iOS or Android - uses native Google Auth
} else {
  // Web browser - uses OAuth redirect
}
```

## 🔐 Google Cloud Console Setup (If Needed)

If you need to create a new Google OAuth client:

1. Go to https://console.cloud.google.com
2. Create a new project or select existing
3. Enable Google+ API
4. Go to Credentials → Create Credentials → OAuth 2.0 Client ID
5. Create **TWO** client IDs:

   **Web Client ID** (for Supabase):
   - Application type: Web application
   - Authorized redirect URIs:
     - `https://furwuyjptohobrvyyzfy.supabase.co/auth/v1/callback`
   - Copy the Client ID to `VITE_GOOGLE_CLIENT_ID`

   **iOS Client ID** (for native app):
   - Application type: iOS
   - Bundle ID: `com.glyde.app`
   - This generates an iOS URL scheme automatically

6. Update both client IDs in:
   - `.env` → `VITE_GOOGLE_CLIENT_ID` (use Web Client ID)
   - `capacitor.config.json` → `serverClientId` (use Web Client ID)

## 🚢 Production Deployment

### Backend

1. Deploy your Express backend to a cloud provider (Railway, Render, AWS, etc.)
2. Get the production URL (e.g., `https://api.glyde.app`)
3. Update `.env`:
   ```bash
   VITE_AGENT_SERVICE_URL=https://api.glyde.app
   ```

### iOS App Store

1. Update app version in Xcode
2. Archive the app (Product → Archive)
3. Distribute to TestFlight or App Store
4. Configure proper OAuth redirect URIs for production domain

## 📝 Next Steps

- [ ] Test on iOS device with local backend
- [ ] Test all auth flows (Google, Email/Password, Sign Out)
- [ ] Test calendar operations (create, update, delete events)
- [ ] Set up Android platform (`npx cap add android`)
- [ ] Configure production backend URL
- [ ] Submit to App Store

## 🆘 Need Help?

Check the logs:
- **Xcode Console**: For native errors and Google Auth issues
- **Backend Terminal**: For API request logs
- **Browser DevTools** (web testing): For network requests

Common files to check:
- `apps/frontend/src/lib/authContext.tsx` - Authentication logic
- `apps/frontend/src/lib/apiConfig.ts` - API URL configuration
- `apps/frontend/capacitor.config.json` - Capacitor settings
- `apps/frontend/ios/App/App/Info.plist` - iOS permissions and URL schemes
