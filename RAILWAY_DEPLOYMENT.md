# Railway Deployment Guide for PMax (Updated)

## ✅ What's Fixed:

- **Removed problematic Dockerfile** - Using Railway's default Nixpacks builder instead
- **Added nixpacks.toml configuration** - Handles ffmpeg-static properly with SKIP_FFMPEG_DOWNLOAD=1
- **System ffmpeg installation** - Nixpacks installs system ffmpeg for production
- **Fixed authentication** - Fully switched to Clerk authentication

## Step 1: Push Your Code to GitHub

1. Make sure all your changes are committed:

```bash
git add .
git commit -m "Fix Railway deployment with Nixpacks and Clerk auth"
git push origin main
```

## Step 2: Deploy to Railway

### Option A: Connect GitHub Repository (Recommended)

1. Go to [Railway.app](https://railway.app) and sign in
2. Click "New Project" → "Deploy from GitHub repo"
3. Select your PMax repository
4. Railway will automatically detect the Node.js project and use Nixpacks

### Option B: Use Railway CLI

```bash
# Install Railway CLI
npm install -g @railway/cli

# Login and deploy
railway login
railway link
railway up
```

## Step 3: Configure Environment Variables

In Railway dashboard, add these environment variables:

### Required Clerk Variables:

```
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=pk_test_...
CLERK_SECRET_KEY=sk_test_...
NEXT_PUBLIC_CLERK_SIGN_IN_URL=/sign-in
NEXT_PUBLIC_CLERK_SIGN_UP_URL=/sign-up
NEXT_PUBLIC_CLERK_AFTER_SIGN_IN_URL=/dashboard
NEXT_PUBLIC_CLERK_AFTER_SIGN_UP_URL=/dashboard
```

### Database Variables:

```
DATABASE_URL=postgresql://...
```

### AWS S3 Variables (if using):

```
AWS_REGION=us-east-1
AWS_ACCESS_KEY_ID=...
AWS_SECRET_ACCESS_KEY=...
S3_BUCKET_NAME=...
```

### API Keys:

```
OPENAI_API_KEY=sk-...
RUNWAY_API_KEY=...
FAL_KEY=...
```

### Build Variables (automatically set by nixpacks.toml):

```
SKIP_FFMPEG_DOWNLOAD=1
FONTCONFIG_PATH=./fonts
CANVAS_FONT_PATH=./fonts
```

## Step 4: Railway Will Automatically:

1. **Install System Dependencies**: ffmpeg, fonts, etc.
2. **Skip ffmpeg-static Download**: Uses SKIP_FFMPEG_DOWNLOAD=1
3. **Install Node Dependencies**: Using pnpm
4. **Generate Prisma Client**: Automatically
5. **Build the Application**: With proper font and ffmpeg paths
6. **Start the Application**: With optimized configuration

## Step 5: Test Deployment

Once deployed, Railway will provide a URL like: `https://your-app-name.railway.app`

Test:

- ✅ Landing page loads
- ✅ Sign-in/Sign-up with Clerk works
- ✅ Dashboard accessible after auth
- ✅ Video processing features work (with system ffmpeg)

## Troubleshooting:

### If Build Fails:

- Check the Railway build logs for specific errors
- Ensure all environment variables are set correctly
- Verify Prisma schema is valid

### If FFmpeg Issues:

- The nixpacks.toml configuration should handle this automatically
- Check logs for "SKIP_FFMPEG_DOWNLOAD=1" message
- System ffmpeg should be available via apt packages

### If Auth Issues:

- Verify all Clerk environment variables are correct
- Check Clerk dashboard for webhook configuration
- Ensure domain is added to Clerk's allowed origins

## Why This Works Better:

1. **Railway Nixpacks**: Native support for complex dependencies
2. **No Docker complexity**: Simpler, more reliable builds
3. **System FFmpeg**: More stable than downloading binaries
4. **Automatic optimization**: Railway handles production optimizations
5. **Better error handling**: Clear logs and debugging info

Your app should now deploy successfully to Railway! 🚀
