# Railway Deployment Guide for PMax

## Step 1: Push Your Code to GitHub

1. Make sure all your changes are committed:
```bash
git add .
git commit -m "Prepare for Railway deployment"
git push origin main
```

## Step 2: Set Up Railway Project

1. Go to [railway.app](https://railway.app) and sign in
2. Click "New Project"
3. Select "Deploy from GitHub repo"
4. Choose your PMax repository
5. Railway will automatically detect it's a Next.js app

## Step 3: Add PostgreSQL Database

1. In your Railway project dashboard, click "New Service"
2. Select "Database" → "Add PostgreSQL"
3. Railway will create a PostgreSQL instance
4. Copy the connection string from the PostgreSQL service

## Step 4: Configure Environment Variables

In your Railway project, go to Variables tab and add these environment variables:

### Database
- `DATABASE_URL`: Use the PostgreSQL connection string from Railway

### Auth (Clerk)
- `CLERK_SECRET_KEY`: Your Clerk secret key
- `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY`: Your Clerk publishable key

### AI Services
- `OPENAI_API_KEY`: Your OpenAI API key
- `ELEVENLABS_API_KEY`: Your ElevenLabs API key
- `RUNWARE_API_KEY`: Your Runware API key
- `RUNWAYML_API_KEY`: Your RunwayML API key
- `PIKALABS_API_KEY`: Your PikaLabs API key
- `FAL_KEY`: Your FAL API key

### Storage (Wasabi S3)
- `WASABI_ACCESS_KEY`: Your Wasabi access key
- `WASABI_SECRET_ACCESS_KEY`: Your Wasabi secret key

### Upload
- `UPLOADTHING_SECRET`: Your UploadThing secret
- `UPLOADTHING_APP_ID`: Your UploadThing app ID

### Required for Production
- `NODE_ENV`: `production`
- `FONTCONFIG_PATH`: `./fonts`
- `CANVAS_FONT_PATH`: `./fonts`

## Step 5: Update Clerk Configuration

1. Go to your Clerk dashboard
2. Update the allowed origins and redirect URLs to include your Railway domain:
   - `https://your-app-name.up.railway.app`
   - Add your custom domain when ready

## Step 6: Deploy

1. Railway will automatically deploy when you push to GitHub
2. You can also manually trigger deployment from the Railway dashboard
3. Monitor the build logs for any issues

## Step 7: Custom Domain Setup

### After purchasing your domain:

1. In your Railway project, go to Settings → Domains
2. Click "Custom Domain" 
3. Enter your domain (e.g., `yourdomain.com`)
4. Railway will provide CNAME records
5. In your domain registrar's DNS settings, add the CNAME records:
   - Type: CNAME
   - Name: @ (for root domain) or www
   - Value: The target provided by Railway

### SSL Certificate
Railway automatically provides SSL certificates for custom domains.

## Step 8: Database Migration

After first deployment, run database migration:
1. Go to your Railway project
2. In the web service, go to "Deploy" → "Run Command"
3. Run: `npx prisma db push`

## Step 9: Font Setup (Important!)

Your app uses local fonts. Ensure the `fonts` directory is included in your repository and deployment.

## Step 10: Test Your Deployment

1. Visit your Railway URL: `https://your-app-name.up.railway.app`
2. Test all major features:
   - User authentication
   - Video creation
   - Element editing
   - Video rendering
   - File uploads

## Troubleshooting

### Common Issues:

1. **Database Connection**: Ensure DATABASE_URL is correctly set
2. **Auth Issues**: Update Clerk URLs to match your deployment URL
3. **Font Loading**: Verify fonts directory is in the deployment
4. **API Keys**: Double-check all API keys are correctly set

### Useful Railway Commands:
- View logs: Check the "Deploy" logs in Railway dashboard
- Environment Variables: Update in Variables tab
- Manual Deploy: Click "Deploy" in the Railway dashboard

## Monitoring

- Railway provides built-in monitoring
- Check "Metrics" tab for performance data
- Set up alerts for downtime

## Scaling

Railway auto-scales based on traffic. For heavy video processing, consider:
- Upgrading to Railway Pro for more resources
- Implementing queue system for video rendering
- Using Railway's horizontal scaling features

## Security Checklist

- [ ] All environment variables are set
- [ ] Database is secured (Railway handles this)
- [ ] Clerk is configured with correct domains
- [ ] API keys are not exposed in client code
- [ ] HTTPS is enabled (Railway handles this)

## Backup Strategy

- Railway PostgreSQL includes automatic backups
- Consider implementing regular data exports
- Keep environment variables documented securely
