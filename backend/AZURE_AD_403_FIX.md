# Fixing 403 Forbidden Error for Azure AD Graph API

## Error Message
```
HTTP Error: Client error '403 Forbidden' for url 'https://graph.windows.net/me?api-version=1.6'
```

## Root Cause

This error occurs when your Azure AD App Registration doesn't have the required **API permissions** to access the Azure AD Graph API, or the permissions haven't been granted **admin consent**.

## Solution: Add Required API Permissions

### Step 1: Go to Azure Portal

1. Navigate to **Azure Portal** → **Azure Active Directory** → **App registrations**
2. Select your app registration (the one used for KTech SSO)

### Step 2: Add API Permissions

1. Click on **"API permissions"** in the left menu
2. Click **"+ Add a permission"**
3. Select **"Azure Active Directory Graph"** (NOT Microsoft Graph)
4. Select **"Delegated permissions"**
5. Add the following permissions:
   - ✅ **`User.Read`** - Sign in and read user profile
   - ✅ **`openid`** - Sign users in (usually already added)
   - ✅ **`profile`** - View users' basic profile (usually already added)
   - ✅ **`email`** - View users' email address (usually already added)

6. Click **"Add permissions"**

### Step 3: Grant Admin Consent

**IMPORTANT:** After adding permissions, you **MUST** grant admin consent:

1. Click the **"Grant admin consent for [Your Organization]"** button
2. Confirm the action
3. Wait for the status to change to **"Granted for [Your Organization]"** (green checkmark)

**Note:** Without admin consent, users will see consent prompts and the API calls will fail with 403.

### Step 4: Verify Permissions

After granting consent, verify that:
- All permissions show **"Granted for [Your Organization]"** with a green checkmark
- No permissions are in "Pending admin approval" status

## Alternative: Use Microsoft Graph API (Recommended)

If you prefer to use the modern Microsoft Graph API instead of the legacy Azure AD Graph API:

### Step 1: Update Environment Variables

In your `backend/.env` file, change:

```env
# Change from:
KKOAUTH_RESOURCE_URI=https://graph.windows.net

# To:
KKOAUTH_RESOURCE_URI=https://graph.microsoft.com
```

### Step 2: Add Microsoft Graph Permissions

1. In Azure Portal → App registrations → Your app → **API permissions**
2. Click **"+ Add a permission"**
3. Select **"Microsoft Graph"** (NOT Azure Active Directory Graph)
4. Select **"Delegated permissions"**
5. Add:
   - ✅ **`User.Read`** - Sign in and read user profile
   - ✅ **`openid`** - Sign users in
   - ✅ **`profile`** - View users' basic profile
   - ✅ **`email`** - View users' email address

6. Click **"Add permissions"**
7. **Grant admin consent** (same as Step 3 above)

### Step 3: Restart Backend

After changing the resource URI, restart your backend:

```bash
sudo systemctl restart osucsc-backend
```

## Verification

After making changes:

1. **Wait 5-10 minutes** for Azure AD to propagate the changes
2. Try the SSO login again: `https://yourdomain.com/sso/ktech`
3. Check backend logs for any errors:
   ```bash
   sudo journalctl -u osucsc-backend -f
   ```

## Common Issues

### Issue 1: "Permissions still pending after granting consent"

**Solution:**
- Wait 5-10 minutes for propagation
- Try revoking and re-granting consent
- Check if you have the correct admin role (Global Administrator or Privileged Role Administrator)

### Issue 2: "Still getting 403 after adding permissions"

**Solution:**
- Verify the app registration Client ID matches your `.env` file
- Check that admin consent was actually granted (green checkmark)
- Try using a different user account (sometimes cached permissions cause issues)
- Clear browser cache and cookies

### Issue 3: "Can't find Azure Active Directory Graph in API permissions"

**Solution:**
- Azure AD Graph API is being deprecated
- Use Microsoft Graph API instead (see "Alternative" section above)
- Update `KKOAUTH_RESOURCE_URI` to `https://graph.microsoft.com`

## Required Permissions Summary

### For Azure AD Graph API (Legacy):
- `User.Read` (Delegated)
- `openid` (Delegated)
- `profile` (Delegated)
- `email` (Delegated)

### For Microsoft Graph API (Recommended):
- `User.Read` (Delegated)
- `openid` (Delegated)
- `profile` (Delegated)
- `email` (Delegated)

## Testing

After configuration, test the SSO flow:

1. Navigate to: `https://yourdomain.com/sso/ktech`
2. You should be redirected to Azure AD login
3. After successful login, you should be redirected back
4. Check backend logs to ensure no 403 errors

## Additional Notes

- **Admin consent is required** for organization-wide access
- **User consent** may work for individual users, but admin consent is recommended
- **Permissions take time to propagate** - wait 5-10 minutes after granting
- **Azure AD Graph API is deprecated** - consider migrating to Microsoft Graph API
- The error occurs in the `validate_token()` function in `helpers/oauth_helper.py` at line 152

## Code Location

The error occurs when calling:
- **File:** `backend/helpers/oauth_helper.py`
- **Function:** `validate_token()`
- **Line:** 152 (for Azure AD Graph) or 149 (for Microsoft Graph)

The function makes a GET request to:
- Azure AD Graph: `https://graph.windows.net/me?api-version=1.6`
- Microsoft Graph: `https://graph.microsoft.com/v1.0/me`

---

**Last Updated:** 2024
