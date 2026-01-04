# CSRF Protection Implementation

## Overview

CSRF (Cross-Site Request Forgery) protection has been added to ZippiCRM to prevent unauthorized state-changing requests from malicious websites.

## Implementation Details

### Server-Side Protection

#### 1. CSRF Middleware (`/server/csrf.ts`)

A custom CSRF protection middleware was implemented with the following features:

- **Token Generation**: Uses Node.js crypto module to generate secure CSRF tokens
- **Session-Based Secrets**: Each user session gets a unique CSRF secret stored in session
- **Automatic Validation**: Validates CSRF tokens on all state-changing requests (POST, PUT, DELETE, PATCH)
- **Public Endpoint Exemption**: Login, register, and other public endpoints are exempt from CSRF protection

#### 2. Protected Routes

All authenticated API endpoints are protected except:
- `/api/v1/csrf-token` - Token generation endpoint
- `/api/health` - Health check endpoint
- `/api/auth/login` - Login endpoint (no session yet)
- `/api/auth/register` - Registration endpoint (no session yet)
- `/api/tenants/by-slug/*` - Public tenant lookup
- `/api/contact` - Public contact form
- `/api/demo` - Public demo request

#### 3. Token Endpoint

**GET /api/v1/csrf-token**

Returns a fresh CSRF token for the current session:

```json
{
  "csrfToken": "a1b2c3d4e5f6..."
}
```

### Client-Side Integration

#### 1. Query Client Updates (`/client/src/lib/queryClient.ts`)

The `apiRequest` function was enhanced to:

1. **Automatic Token Fetching**: Fetches CSRF token on first state-changing request
2. **Token Caching**: Caches token in memory to avoid repeated requests
3. **Token Refresh**: Automatically refreshes token on 403 CSRF errors
4. **Retry Logic**: Retries failed requests once with a fresh token
5. **Header Injection**: Adds `X-CSRF-Token` header to POST, PUT, DELETE, PATCH requests

#### 2. Logout Integration

The logout handler clears the cached CSRF token to prevent token reuse:

```typescript
clearCsrfToken(); // Called on successful logout
```

## How It Works

### Request Flow

1. **User Authenticates**: User logs in and establishes a session
2. **First State-Changing Request**: Frontend detects POST/PUT/DELETE/PATCH request
3. **Token Fetch**: `apiRequest` fetches CSRF token from `/api/v1/csrf-token`
4. **Token Caching**: Token is cached in memory for subsequent requests
5. **Token Validation**: Server validates token against session secret
6. **Request Processing**: Valid requests proceed; invalid requests return 403

### Token Lifecycle

```
Login → Generate Session Secret → Request CSRF Token → Cache Token →
Use Token in Requests → Logout → Clear Token
```

### Security Features

1. **Session-Bound Tokens**: Each token is tied to a specific session
2. **Short-Lived Tokens**: Tokens are invalidated on logout or session expiry
3. **Automatic Refresh**: Stale tokens are automatically refreshed
4. **No Storage**: Tokens are stored in memory only (not localStorage/cookies)
5. **Header-Based**: Uses custom header instead of cookies for token transmission

## Usage Examples

### Frontend API Requests

No changes needed! The existing `apiRequest` function handles everything:

```typescript
// This automatically includes CSRF token
await apiRequest('POST', '/api/customers', customerData);
await apiRequest('PUT', '/api/products/123', productData);
await apiRequest('DELETE', '/api/orders/456');
```

### Manual Fetch Requests

If making manual fetch requests, include the CSRF token:

```typescript
const tokenRes = await fetch('/api/v1/csrf-token', {
  credentials: 'include'
});
const { csrfToken } = await tokenRes.json();

const response = await fetch('/api/customers', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'X-CSRF-Token': csrfToken
  },
  credentials: 'include',
  body: JSON.stringify(customerData)
});
```

## Error Handling

### 403 CSRF Error Response

```json
{
  "error": "Invalid CSRF token",
  "message": "Token CSRF inválido. Por favor, recarregue a página."
}
```

The frontend automatically:
1. Detects CSRF errors
2. Clears cached token
3. Fetches fresh token
4. Retries request once

## Testing CSRF Protection

### Test Valid Request

```bash
# 1. Login and get session cookie
curl -c cookies.txt -X POST http://localhost:5000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"username":"user@example.com","password":"password"}'

# 2. Get CSRF token
curl -b cookies.txt http://localhost:5000/api/v1/csrf-token

# 3. Make protected request with token
curl -b cookies.txt -X POST http://localhost:5000/api/customers \
  -H "Content-Type: application/json" \
  -H "X-CSRF-Token: YOUR_TOKEN_HERE" \
  -d '{"name":"Test Customer"}'
```

### Test Invalid Request (Should Fail)

```bash
# Try making request without CSRF token
curl -b cookies.txt -X POST http://localhost:5000/api/customers \
  -H "Content-Type: application/json" \
  -d '{"name":"Test Customer"}'

# Expected: 403 Forbidden with CSRF error
```

## Security Considerations

### What This Protects Against

1. **Cross-Site Request Forgery**: Prevents malicious sites from making authenticated requests
2. **CSRF Attacks**: Blocks forged state-changing requests
3. **Session Riding**: Prevents unauthorized actions using stolen session cookies

### What This Does NOT Protect Against

1. **XSS Attacks**: Use Content Security Policy (CSP) and input sanitization
2. **Man-in-the-Middle**: Use HTTPS in production
3. **Credential Theft**: Use strong passwords and 2FA
4. **SQL Injection**: Use parameterized queries (already implemented via Drizzle ORM)

## Configuration

### Environment Variables

No additional environment variables needed. CSRF protection uses existing session configuration.

### Production Considerations

1. **HTTPS Required**: Ensure `secure: true` in session cookie config for production
2. **Session Secret**: Use strong random SESSION_SECRET in production
3. **Rate Limiting**: Already implemented - limits token fetch requests
4. **Token Rotation**: Tokens are rotated on session change

## Maintenance

### Updating Public Endpoints

If adding new public endpoints that should bypass CSRF protection, update the `publicEndpoints` array in `/server/csrf.ts`:

```typescript
const publicEndpoints = [
  "/health",
  "/auth/login",
  "/auth/register",
  "/tenants/by-slug",
  "/contact",
  "/demo",
  "/your-new-endpoint"  // Add here
];
```

### Debugging

Enable CSRF debug logging by adding to `/server/csrf.ts`:

```typescript
export function csrfProtection(req: Request, res: Response, next: NextFunction) {
  console.log('[CSRF] Checking request:', req.method, req.path);
  console.log('[CSRF] Token:', req.headers["x-csrf-token"]);
  console.log('[CSRF] Session:', req.session.csrfSecret);
  // ... rest of function
}
```

## Files Modified

1. `/server/csrf.ts` - New CSRF middleware module
2. `/server/index.ts` - Added CSRF setup
3. `/client/src/lib/queryClient.ts` - Added CSRF token handling
4. `/client/src/hooks/use-auth.ts` - Added token cleanup on logout

## References

- [OWASP CSRF Prevention Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Cross-Site_Request_Forgery_Prevention_Cheat_Sheet.html)
- [Express Session Documentation](https://expressjs.com/en/resources/middleware/session.html)
- [Node.js Crypto Module](https://nodejs.org/api/crypto.html)
