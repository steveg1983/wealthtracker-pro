#!/bin/bash

# GitHub Secrets Setup Helper Script
# This script helps you set up the required secrets for the CI/CD pipeline
# Usage: ./setup-secrets.sh

set -e

echo "=========================================="
echo "WealthTracker CI/CD Secrets Setup"
echo "=========================================="
echo ""
echo "This script will help you configure the required GitHub secrets"
echo "for your CI/CD pipeline to work correctly."
echo ""

# Check if gh CLI is installed
if ! command -v gh &> /dev/null; then
    echo "❌ GitHub CLI (gh) is not installed."
    echo "Please install it first: https://cli.github.com/"
    echo ""
    echo "Installation commands:"
    echo "  macOS:  brew install gh"
    echo "  Linux:  see https://github.com/cli/cli/blob/trunk/docs/install_linux.md"
    echo "  Windows: winget install --id GitHub.cli"
    exit 1
fi

# Check if authenticated
if ! gh auth status &> /dev/null; then
    echo "❌ You are not authenticated with GitHub CLI."
    echo "Please run: gh auth login"
    exit 1
fi

# Get repository name
REPO=$(gh repo view --json nameWithOwner -q .nameWithOwner 2>/dev/null || echo "")
if [ -z "$REPO" ]; then
    echo "❌ Could not detect repository. Make sure you're in the repository directory."
    exit 1
fi

echo "✅ Repository detected: $REPO"
echo ""

# Function to set a secret
set_secret() {
    local name=$1
    local prompt=$2
    local required=$3
    
    echo "----------------------------------------"
    echo "Secret: $name"
    echo "Description: $prompt"
    echo ""
    
    if [ "$required" = "required" ]; then
        echo "⚠️  This secret is REQUIRED for the pipeline to work"
    else
        echo "ℹ️  This secret is optional"
    fi
    
    echo ""
    read -p "Enter value (or press Enter to skip): " value
    
    if [ -n "$value" ]; then
        echo "$value" | gh secret set "$name" -R "$REPO"
        echo "✅ Secret $name has been set"
    else
        if [ "$required" = "required" ]; then
            echo "⚠️  Warning: $name is required but was skipped"
        else
            echo "⏭️  Skipped $name"
        fi
    fi
    echo ""
}

echo "=========================================="
echo "REQUIRED SECRETS"
echo "=========================================="
echo ""

# Required secrets
set_secret "VITE_SUPABASE_URL" "Supabase project URL (e.g., https://xxx.supabase.co)" "required"
set_secret "VITE_SUPABASE_ANON_KEY" "Supabase anonymous key" "required"
set_secret "VITE_CLERK_PUBLISHABLE_KEY" "Clerk publishable key (pk_test_xxx or pk_live_xxx)" "required"

echo "=========================================="
echo "OPTIONAL SECRETS (For Enhanced Features)"
echo "=========================================="
echo ""

# Deployment secrets
echo "### Deployment (Vercel) ###"
set_secret "VERCEL_TOKEN" "Vercel authentication token" "optional"
set_secret "VERCEL_ORG_ID" "Vercel organization ID" "optional"
set_secret "VERCEL_PROJECT_ID" "Vercel project ID" "optional"

# Error tracking
echo "### Error Tracking (Sentry) ###"
set_secret "VITE_SENTRY_DSN" "Sentry DSN URL" "optional"
set_secret "SENTRY_AUTH_TOKEN" "Sentry authentication token" "optional"
set_secret "SENTRY_ORG" "Sentry organization name" "optional"
set_secret "SENTRY_PROJECT" "Sentry project name" "optional"

# Security and monitoring
echo "### Security & Monitoring ###"
set_secret "SNYK_TOKEN" "Snyk authentication token" "optional"
set_secret "CODECOV_TOKEN" "Codecov upload token" "optional"

# Notifications
echo "### Notifications ###"
set_secret "SLACK_WEBHOOK_URL" "Slack webhook URL for notifications" "optional"

# Financial APIs
echo "### Financial Data APIs ###"
set_secret "VITE_ALPHA_VANTAGE_API_KEY" "Alpha Vantage API key for market data" "optional"

echo "=========================================="
echo "Setup Complete!"
echo "=========================================="
echo ""
echo "✅ Secrets have been configured for repository: $REPO"
echo ""
echo "Next steps:"
echo "1. Verify your secrets at: https://github.com/$REPO/settings/secrets/actions"
echo "2. Run your CI/CD pipeline to test the configuration"
echo "3. Check the Actions tab for any errors: https://github.com/$REPO/actions"
echo ""
echo "For more information, see .github/CI_CD_SETUP.md"