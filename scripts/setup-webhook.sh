#!/bin/bash

echo "🚀 Clerk Webhook Setup Guide"
echo "=========================="
echo ""
echo "This script will help you set up Clerk webhooks for local development."
echo ""

# Check if ngrok is installed
if ! command -v ngrok &> /dev/null; then
    echo "❌ ngrok is not installed. Please install it first:"
    echo "   brew install ngrok"
    exit 1
fi

echo "✅ ngrok is installed"
echo ""
echo "📋 Follow these steps:"
echo ""
echo "1. First, run ngrok in a separate terminal:"
echo "   ngrok http 3000"
echo ""
echo "2. Copy the HTTPS forwarding URL (e.g., https://abc123.ngrok-free.app)"
echo ""
echo "3. In your Clerk Dashboard (https://dashboard.clerk.com):"
echo "   - Navigate to Webhooks"
echo "   - Click 'Add Endpoint'"
echo "   - Set Endpoint URL to: <YOUR_NGROK_URL>/api/webhooks/clerk"
echo "   - Select these events:"
echo "     ✓ user.created"
echo "     ✓ user.updated"
echo "     ✓ user.deleted"
echo "   - Click 'Create'"
echo ""
echo "4. Copy the Signing Secret from the webhook settings"
echo ""
echo "5. Update your .env file:"
echo "   CLERK_WEBHOOK_SECRET=<YOUR_SIGNING_SECRET>"
echo ""
echo "📝 Your webhook endpoint is ready at:"
echo "   /api/webhooks/clerk"
echo ""
echo "🧪 To test:"
echo "   1. Sign up with a new account"
echo "   2. Check your server logs for webhook events"
echo "   3. Verify the user was created in your database"
echo ""
echo "💡 Tips:"
echo "   - Keep ngrok running while developing"
echo "   - The free ngrok URL changes each time you restart"
echo "   - Consider ngrok's paid static domain for consistency"
echo ""
echo "Press any key to open ngrok dashboard..."
read -n 1 -s

# Open ngrok dashboard
open https://dashboard.ngrok.com/