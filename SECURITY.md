# Security Documentation

## Overview

ZippiCRM implements several security best practices to protect your data and ensure safe operation in production environments.

## Environment Variables

### Required in Production

The following environment variables are **REQUIRED** when `NODE_ENV=production`:

- `ADMIN_EMAIL` - Email address for the super admin account
- `ADMIN_PASSWORD` - Secure password for the super admin account
- `SESSION_SECRET` - Secret key for session encryption

**The application will fail to start if these are not set in production.**

### Development Mode

In development mode (`NODE_ENV=development`), the application provides more flexibility:

- If `ADMIN_PASSWORD` is not set, a warning is displayed and superadmin bootstrap is skipped
- Administrative credentials are never generated or printed by the application
- If `ADMIN_EMAIL` is omitted, local development falls back to `admin@zippi.crm`

### Setting Environment Variables

1. **Copy the example file:**

   ```bash
   cp .env.example .env
   ```

2. **Edit `.env` and set your credentials:**

   ```bash
   ADMIN_EMAIL=your-admin@example.com
   ADMIN_PASSWORD=YourSecurePassword123!
   SESSION_SECRET=your-session-secret-here
   ```

3. **Generate a secure session secret:**
   ```bash
   node -e "console.log(require('crypto').randomBytes(64).toString('hex'))"
   ```

## Password Requirements

The application currently enforces that production `ADMIN_PASSWORD` values are
non-placeholder strings with at least 12 characters. Operators should also ensure the password:

- Contains a mix of uppercase and lowercase letters
- Includes numbers and special characters
- Is not a common password or dictionary word
- Is unique to this application

The composition and breached-password recommendations above are operational policy; they are not
currently enforced by the application beyond the length and placeholder checks.

## Security Features

### 1. No Default Production Password

Production authentication credentials must be provided via environment variables. There is no
default password. In non-production environments, the application can use the development email
fallback described above only when an explicit `ADMIN_PASSWORD` is provided.

### 2. Environment-Based Validation

- **Production:** Strict validation - missing credentials cause startup failure
- **Development:** Missing `ADMIN_PASSWORD` produces a warning and skips bootstrap

### 3. Password Hashing

All passwords are hashed using bcrypt with a salt rounds value of 10 before storage.

### 4. Session Security

- Session secrets are required in production
- Session cookies are HTTP-only in every environment, use `SameSite=Lax`, and are marked `Secure` in production
- Session data is stored server-side in SQLite (not in cookies)
- Private state-changing API requests require a CSRF token
- API routes are protected by rate limiters; authentication and password-reset flows have additional limits
- Production responses include Helmet security headers and a restrictive Content Security Policy

## Deployment Security Checklist

Before deploying to production:

- [ ] Set `NODE_ENV=production`
- [ ] Set a strong, unique `ADMIN_EMAIL`
- [ ] Set a strong, unique `ADMIN_PASSWORD`
- [ ] Generate and set a secure `SESSION_SECRET`
- [ ] Verify `.env` file is in `.gitignore`
- [ ] Never commit actual credentials to version control
- [ ] Use platform-specific secret management (Railway, Render, etc.)
- [ ] Enable HTTPS/TLS for all production traffic
- [ ] Configure `TRUST_PROXY` to match the exact number/list of trusted reverse proxies
- [ ] Regularly rotate passwords and secrets

## Platform-Specific Setup

### Render.com

Set environment variables in the Render dashboard:

1. Go to your service settings
2. Navigate to "Environment"
3. Add the required variables
4. Deploy

### Railway.app

Set environment variables in the Railway dashboard:

1. Go to your project
2. Click "Variables"
3. Add the required variables
4. Redeploy

### Docker

Pass environment variables when running the container:

```bash
docker run -p 6000:6000 \
  -e NODE_ENV=production \
  -e ADMIN_EMAIL=admin@example.com \
  -e ADMIN_PASSWORD=SecurePass123! \
  -e SESSION_SECRET=your-secret-here \
  -v zippcrm-data:/app/data \
  zippcrm
```

## Reporting Security Issues

No public security contact is configured in this repository. Report vulnerabilities privately to
the maintainers through the access-controlled project channel. Do not open a public issue containing
exploit details, credentials, personal data, or production data. Configure and publish a dedicated
security contact before external distribution.

## Best Practices

1. **Never commit `.env` files** - They should always be in `.gitignore`
2. **Rotate credentials regularly** - Especially after team member changes
3. **Use different credentials per environment** - Don't reuse production credentials in development
4. **Monitor access logs** - The application emits basic API request logs, but these are not a complete audit trail
5. **Plan 2FA if required** - Two-factor authentication is not currently implemented
6. **Keep dependencies updated** - Run `npm audit` regularly to check for vulnerabilities

## Additional Resources

- [OWASP Top 10](https://owasp.org/www-project-top-ten/)
- [Node.js Security Best Practices](https://nodejs.org/en/docs/guides/security/)
- [Express Security Best Practices](https://expressjs.com/en/advanced/best-practice-security.html)

## Public Lead Capture

`POST /api/v1/contact` and `POST /api/v1/demo` are the only unauthenticated
endpoints that persist personal data. They carry their own controls:

- a dedicated rate limit of 5 requests per hour per IP (`PUBLIC_LEAD_RATE_LIMIT_MAX`),
  because the general limiter of 100 per minute would let a bot store tens of
  thousands of leads a day;
- a closed payload: unknown fields are rejected, so a caller cannot set the
  triage `status` or any other server-owned field;
- bounded string lengths on every field, so one request cannot store a megabyte;
- a hidden honeypot field. A non-empty value means a bot: the submission is
  discarded and the response is still 201, so the caller learns nothing;
- mandatory consent. `consent: true` is required and is stored with a timestamp
  and the policy version, which is what makes holding the data lawful under the
  LGPD. Rows created before migration 0009 keep NULL, which is the truthful
  value: consent was not captured for them.

The privacy policy **text** is still a product decision; the mechanism that
records which version a visitor accepted is in place and versioned by
`PRIVACY_POLICY_VERSION`.
