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

- If `ADMIN_EMAIL` or `ADMIN_PASSWORD` are not set, a warning will be displayed
- If `ADMIN_PASSWORD` is not provided, the system will generate a secure random password
- The generated password will be logged to the console **once** - save it immediately!

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

For production deployments, ensure your `ADMIN_PASSWORD`:

- Is at least 12 characters long
- Contains a mix of uppercase and lowercase letters
- Includes numbers and special characters
- Is not a common password or dictionary word
- Is unique to this application

## Security Features

### 1. No Hardcoded Credentials

All authentication credentials must be provided via environment variables. There are no default passwords in the codebase.

### 2. Environment-Based Validation

- **Production:** Strict validation - missing credentials cause startup failure
- **Development:** Warnings are shown, with automatic password generation as fallback

### 3. Password Hashing

All passwords are hashed using bcrypt with a salt rounds value of 10 before storage.

### 4. Session Security

- Session secrets are required in production
- Sessions use httpOnly cookies in production
- Session data is stored server-side (not in cookies)

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

If you discover a security vulnerability, please email security@example.com (update with your actual security contact).

## Best Practices

1. **Never commit `.env` files** - They should always be in `.gitignore`
2. **Rotate credentials regularly** - Especially after team member changes
3. **Use different credentials per environment** - Don't reuse production credentials in development
4. **Monitor access logs** - Keep track of who accesses the admin account
5. **Enable 2FA when available** - Additional authentication layers improve security
6. **Keep dependencies updated** - Run `npm audit` regularly to check for vulnerabilities

## Additional Resources

- [OWASP Top 10](https://owasp.org/www-project-top-ten/)
- [Node.js Security Best Practices](https://nodejs.org/en/docs/guides/security/)
- [Express Security Best Practices](https://expressjs.com/en/advanced/best-practice-security.html)
