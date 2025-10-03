#!/bin/bash

# Vercel Deployment Script
# Make sure to run 'npx vercel login' first

echo "🚀 Starting Vercel deployment..."

# Check if user is logged in to Vercel
npx vercel whoami > /dev/null 2>&1
if [ $? -ne 0 ]; then
    echo "❌ Error: Not logged in to Vercel"
    echo "Please run: npx vercel login"
    exit 1
fi

echo "✅ Logged in to Vercel"

# Build the project locally first to catch any errors
echo "🔨 Building project locally..."
npm run build
if [ $? -ne 0 ]; then
    echo "❌ Build failed! Please fix the errors above."
    exit 1
fi

echo "✅ Local build successful"

# Deploy to Vercel
echo "📤 Deploying to Vercel..."

# For production deployment
if [ "$1" == "prod" ] || [ "$1" == "production" ]; then
    echo "Deploying to production..."
    npx vercel --prod --yes
else
    echo "Deploying to preview..."
    npx vercel --yes
fi

if [ $? -eq 0 ]; then
    echo "✅ Deployment successful!"
else
    echo "❌ Deployment failed!"
    exit 1
fi