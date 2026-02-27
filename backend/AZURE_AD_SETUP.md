# Azure AD OAuth Setup Guide

## Error: AADSTS500011 - Resource Principal Not Found

This error occurs when the `resource` parameter in the OAuth request doesn't match what's configured in Azure AD.

## Solution

### Option 1: Use Azure AD Graph API (v1.0) - Recommended for compatibility

**For KTech SSO**, the resource URI should be (matches CI3 aad_auth_ktech.php):

```env
KTECH_OAUTH_RESOURCE_URI=https://graph.microsoft.com
```

**Note:** KTech SSO uses Microsoft Graph API, while Client SSO uses Azure AD Graph API.

**For Client SSO**, it should already be:
```env
CLIENT_OAUTH_RESOURCE_URI=https://graph.windows.net
```

### Option 2: Use Microsoft Graph API (v2.0)

If you need to use Microsoft Graph API, you'll need to:
1. Update the code to use v2.0 endpoints
2. Use scopes instead of resource parameter
3. This requires code changes (not just config)

## Callback URLs to Register in Azure AD

You **MUST** register these callback URLs in your Azure AD App Registration:

### KTech SSO Callback URL:
```
http://localhost:8001/api/sso/ktech/oauth/callback
```

For production, replace `localhost:8000` with your production domain:
```
https://yourdomain.com/api/sso/ktech/oauth/callback
```

### Client SSO Callback URL:
```
http://localhost:8001/api/sso/client/oauth/callback
```

For production:
```
https://yourdomain.com/api/sso/client/oauth/callback
```

## Steps to Configure Azure AD App Registration

1. **Go to Azure Portal** → Azure Active Directory → App registrations
2. **Select your app** (or create a new one)
3. **Go to "Authentication"** section
4. **Add Redirect URIs:**
   - Click "Add a platform" → "Web"
   - Add the callback URLs listed above
   - Make sure to add both:
     - `http://localhost:8001/api/sso/ktech/oauth/callback` (for development)
     - `https://yourdomain.com/api/sso/ktech/oauth/callback` (for production)
5. **Save** the changes

## Required API Permissions

**⚠️ IMPORTANT: This step is CRITICAL and often missed!**

Your Azure AD app needs these permissions:

1. **Azure Active Directory Graph** (if using `graph.windows.net`):
   - `User.Read` (Delegated) - To read user profile
   - `openid` (Delegated) - For OpenID Connect
   - `profile` (Delegated) - For user profile information
   - `email` (Delegated) - For user email

   **OR**

2. **Microsoft Graph** (if using `graph.microsoft.com`):
   - `User.Read` (Delegated) - To read user profile
   - `openid` (Delegated) - For OpenID Connect
   - `profile` (Delegated) - For user profile information
   - `email` (Delegated) - For user email

3. **⚠️ CRITICAL: Grant admin consent**
   - After adding permissions, you **MUST** click **"Grant admin consent for [Your Organization]"**
   - Without admin consent, you'll get **403 Forbidden** errors
   - See `AZURE_AD_403_FIX.md` for detailed instructions

## Environment Variables

Make sure your `.env` file has:

```env
# KTech SSO - OAuth (uses Microsoft Graph API)
KTECH_OAUTH_TENANT_ID=your-tenant-id
KTECH_OAUTH_CLIENT_ID=your-client-id
KTECH_OAUTH_CLIENT_SECRET=your-client-secret
KTECH_OAUTH_RESOURCE_URI=https://graph.microsoft.com
KTECH_OAUTH_AUTHORITY=https://login.microsoftonline.com

# Client SSO - OAuth
CLIENT_OAUTH_TENANT_ID=your-tenant-id
CLIENT_OAUTH_CLIENT_ID=your-client-id
CLIENT_OAUTH_CLIENT_SECRET=your-client-secret
CLIENT_OAUTH_RESOURCE_URI=https://graph.windows.net
CLIENT_OAUTH_AUTHORITY=https://login.microsoftonline.com

# Base URLs
BASE_URL=http://localhost:8001
FRONTEND_URL=http://localhost:5173
```

## Testing

After configuration:
1. Restart your backend server
2. Try accessing: `http://localhost:8001/sso/ktech`
3. You should be redirected to Azure AD login
4. After login, you'll be redirected back to the callback URL

## Troubleshooting

### Error: "403 Forbidden" for graph.windows.net/me
**This is the most common error after callback!**
- **See detailed fix guide**: `AZURE_AD_403_FIX.md`
- **Quick fix**: Add API permissions in Azure AD App Registration:
  1. Go to Azure Portal → App registrations → Your app → API permissions
  2. Add permission: **Azure Active Directory Graph** → **Delegated** → **User.Read**
  3. **CRITICAL**: Click **"Grant admin consent"** button
  4. Wait 5-10 minutes for propagation
  5. Try SSO login again

### Error: "The resource principal named https://graph.microsoft.com/v1.0 was not found"
- **Fix**: Change `KTECH_OAUTH_RESOURCE_URI` to `https://graph.windows.net` in `.env`

### Error: "redirect_uri_mismatch"
- **Fix**: Make sure the callback URL in Azure AD exactly matches what's in your code
- Check for trailing slashes, http vs https, port numbers

### Error: "invalid_client"
- **Fix**: Check that `CLIENT_ID` and `CLIENT_SECRET` are correct in `.env`

### Error: "invalid_tenant"
- **Fix**: Verify `TENANT_ID` is correct (can be tenant ID or domain name)

## Notes

- The v1.0 endpoint (`/oauth2/authorize` and `/oauth2/token`) uses `resource` parameter
- The v2.0 endpoint (`/oauth2/v2.0/authorize`) uses `scope` parameter
- This implementation uses v1.0 for compatibility with existing CI3 code
- For v2.0, you'd need to change the authorization URL format and use scopes
