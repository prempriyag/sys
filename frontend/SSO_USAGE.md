# SSO Frontend Integration Guide

## Overview
The frontend supports SSO login for both Client and KTech users. The SSO flow automatically handles OAuth or SAML based on backend configuration.

## How to Use SSO from Frontend

### 1. Direct URL Access
You can directly navigate to SSO endpoints:
- **Client SSO**: `http://localhost:5173/sso/client` or `http://localhost:8000/sso/client`
- **KTech SSO**: `http://localhost:5173/sso/ktech` or `http://localhost:8000/sso/ktech`

### 2. Using Helper Functions
Import and use the helper functions from `config/api.ts`:

```typescript
import { redirectToClientSSO, redirectToKTechSSO } from "../config/api";

// Redirect to Client SSO
redirectToClientSSO();

// Redirect to KTech SSO
redirectToKTechSSO();

// With return URL
redirectToKTechSSO(window.location.href);
```

### 3. From Sign-In Form
The Sign-In form already includes SSO buttons:
- "Sign in with Client SSO" button
- "Sign in with KTech SSO" button

### 4. SSO Flow
1. User clicks SSO button or navigates to `/sso/client` or `/sso/ktech`
2. Frontend redirects to backend SSO endpoint (`/sso/client` or `/sso/ktech`)
3. Backend detects active SSO method (OAuth or SAML) and redirects to IdP
4. User authenticates with IdP (Azure AD, PingOne, etc.)
5. IdP redirects back to backend callback endpoint
6. Backend processes authentication and redirects to frontend with token
7. Frontend `/sso/callback` page receives token and completes login
8. User is redirected to appropriate dashboard based on permissions

### 5. Configuration
Make sure your `.env` file has:
```env
BASE_URL=http://localhost:8000
FRONTEND_URL=http://localhost:5173
```

And configure the appropriate SSO settings (OAuth or SAML) for Client and KTech.

## API Endpoints Available

### Frontend Routes
- `/sso/client` - Client SSO login (redirects to backend)
- `/sso/ktech` - KTech SSO login (redirects to backend)
- `/sso/callback` - SSO callback handler (receives token from backend)

### Backend Endpoints (called automatically)
- `/sso/client` or `/api/sso/client` - Client SSO entry point
- `/sso/ktech` or `/api/sso/ktech` - KTech SSO entry point
- `/api/sso/client/oauth/callback` - Client OAuth callback
- `/api/sso/client/saml/callback` - Client SAML callback
- `/api/sso/ktech/oauth/callback` - KTech OAuth callback
- `/api/sso/ktech/saml/callback` - KTech SAML callback

## Example Usage

### In a Component
```typescript
import { redirectToKTechSSO } from "../config/api";

function MyComponent() {
  const handleSSOLogin = () => {
    redirectToKTechSSO();
  };

  return (
    <button onClick={handleSSOLogin}>
      Login with KTech SSO
    </button>
  );
}
```

### Direct Navigation
```typescript
// Using React Router
import { useNavigate } from "react-router";
const navigate = useNavigate();
navigate("/sso/ktech");

// Or using window.location
window.location.href = "http://localhost:8000/sso/ktech";
```

## Notes
- The SSO method (OAuth or SAML) is automatically detected by the backend
- You can force a specific method by setting `CLIENT_SSO_METHOD` or `KTECH_SSO_METHOD` in backend `.env`
- The frontend callback page automatically handles token storage and user session setup
- After successful SSO login, users are redirected based on their permissions (college_perm, hs_perm, ocr_perm)
