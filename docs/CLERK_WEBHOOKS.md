# Clerk Webhooks Setup Guide

This guide explains how to set up Clerk webhooks for local development using ngrok.

## Prerequisites

- ngrok installed (`brew install ngrok`)
- Clerk account with a project
- Local development server running on port 3000

## Quick Setup

1. **Start ngrok tunnel**
   ```bash
   ngrok http 3000
   ```
   Keep this terminal window open. Copy the HTTPS forwarding URL (e.g., `https://abc123.ngrok-free.app`)

2. **Configure Clerk Webhook**
   - Go to [Clerk Dashboard](https://dashboard.clerk.com) → Webhooks
   - Click "Add Endpoint"
   - Set Endpoint URL: `<YOUR_NGROK_URL>/api/webhooks/clerk`
   - Select events:
     - `user.created`
     - `user.updated`
     - `user.deleted`
   - Click "Create"

3. **Copy Webhook Secret**
   - In the webhook settings, copy the "Signing Secret"
   - Update your `.env` file:
     ```env
     CLERK_WEBHOOK_SECRET=whsec_xxxxxxxxxxxxx
     ```

4. **Test the Integration**
   - Sign up with a new account
   - Check server logs for webhook events
   - Verify user was created in database

## Webhook Endpoint

The webhook handler is located at `/api/webhooks/clerk/route.ts` and handles:

- **user.created**: Creates user in database with default permissions
- **user.updated**: Updates user information
- **user.deleted**: Removes user from database

## Permissions System

- **First user** automatically becomes **ADMIN**
- **Regular users** get:
  - `canCreateProjects`: false (must be enabled by admin)
  - `maxProjects`: 10
  - `maxAssetStorage`: 1GB

- **Admins** get:
  - `canCreateProjects`: true
  - `maxProjects`: 1000
  - `maxAssetStorage`: 100GB

## Development Mode

For easier local development without ngrok:

1. **Remove webhook secret** from `.env` (comment it out)
2. **Use auto-sync**: Users are synced when visiting dashboard
3. **Manual sync button**: Available in development mode

## Production Setup

For production, use your actual domain:
```
https://yourdomain.com/api/webhooks/clerk
```

## Troubleshooting

### Webhook not receiving events
- Ensure ngrok is running
- Check the webhook URL in Clerk matches your ngrok URL
- Verify the webhook secret is correct

### User not syncing
- Check server logs for errors
- Ensure database is running
- Try manual sync button in development

### Permission denied errors
- First user should be admin
- Check admin panel at `/admin`
- Manually update user permissions in database if needed

## Security Notes

- Never commit webhook secrets to version control
- Use environment variables for all secrets
- Webhook verification is required in production
- Development mode skips verification if no secret is set