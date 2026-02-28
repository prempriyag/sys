# KTech SSO 403 Error Fix - Resource URI Mismatch

## Problem

You're getting a 403 Forbidden error after KTech SSO callback, even though the same Azure AD credentials work fine in CI3.

## Root Cause

The FastAPI code was using the wrong resource URI for KTech SSO. 

**CI3 KTech SSO uses:**
- `resource_uri = 'https://graph.microsoft.com'` (Microsoft Graph API)
- API endpoint: `https://graph.microsoft.com/v1.0/me`

**FastAPI was defaulting to:**
- `resource_uri = 'https://graph.windows.net'` (Azure AD Graph API - legacy)
- API endpoint: `https://graph.windows.net/me?api-version=1.6`

## Solution

### Option 1: Update .env File (Recommended)

In your `backend/.env` file, make sure you have:

```env
KKOAUTH_RESOURCE_URI=https://graph.microsoft.com
```

**NOT** `https://graph.windows.net`

### Option 2: Code Already Fixed

The default in `backend/config/sso_config.py` has been updated to match CI3:
- Changed from: `https://graph.windows.net`
- Changed to: `https://graph.microsoft.com`

If you don't have `KKOAUTH_RESOURCE_URI` in your `.env`, it will now use the correct default.

## Required API Permissions for Microsoft Graph

Since KTech uses Microsoft Graph API, make sure your Azure AD App Registration has:

1. Go to **Azure Portal** → **App registrations** → Your KTech app → **API permissions**
2. Add permission: **Microsoft Graph** (NOT Azure Active Directory Graph)
3. Add delegated permission: **User.Read**
4. **Grant admin consent**

## Verify Your Configuration

Check your `backend/.env` file:

```env
# Should be graph.microsoft.com for KTech (matches CI3)
KKOAUTH_RESOURCE_URI=https://graph.microsoft.com

# Client SSO uses graph.windows.net (different from KTech)
CLIENT_OAUTH_RESOURCE_URI=https://graph.windows.net
```

## After Making Changes

1. **Restart your backend:**
   ```bash
   sudo systemctl restart osucsc-backend
   # OR if running manually
   # Stop and restart your FastAPI server
   ```

2. **Test KTech SSO:**
   - Navigate to: `https://yourdomain.com/sso/ktech`
   - Should work without 403 errors

## Why This Matters

- **Microsoft Graph API** (`graph.microsoft.com`) is the modern API
- **Azure AD Graph API** (`graph.windows.net`) is the legacy API (being deprecated)
- CI3 KTech SSO uses Microsoft Graph, so FastAPI must match
- Different APIs require different permissions in Azure AD

## Summary

The issue was a **resource URI mismatch**. CI3 KTech SSO uses `graph.microsoft.com`, but FastAPI was defaulting to `graph.windows.net`. The fix is to set `KKOAUTH_RESOURCE_URI=https://graph.microsoft.com` in your `.env` file (or rely on the updated default in the code).

---

**Last Updated:** 2024
