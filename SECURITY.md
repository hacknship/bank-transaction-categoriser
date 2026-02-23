# Security Policy

## Reporting Security Vulnerabilities

If you discover a security vulnerability, please DO NOT open a public issue. Instead, send an email to the project maintainers with details.

## Security Best Practices for This Project

### 🔐 Environment Variables

- **NEVER** commit `.env` files to version control
- Use `.env.example` as a template for required environment variables
- Keep production credentials in a secure password manager or secrets management service
- Rotate credentials regularly (recommended: every 90 days)

### 🛡️ Database Security (Ghost.build)

- Database connection strings should only be stored in environment variables
- Ghost.build provides automatically generated strong passwords
- Use `ghost password` command to rotate credentials regularly
- Use `ghost fork` for safe experimentation with database changes
- All Ghost.build connections use SSL by default
- Enable IP allowlisting at the application level if needed

**Ghost CLI Reference:** https://ghost.build/docs/

### 🔧 Development Setup

1. Copy `.env.example` to `.env`:
   ```bash
   cp .env.example .env
   ```

2. Fill in your actual values in `.env` (this file will NOT be committed)

3. For Netlify deployment, set environment variables in the Netlify dashboard:
   - Go to Site settings → Environment variables
   - Add `DATABASE_URL` with your production database connection string

## Security Incident Response

### What Happened

**Date:** 2026-02-22  
**Severity:** CRITICAL  
**Status:** REMEDIATION IN PROGRESS

Database credentials were accidentally committed to the Git repository in commit `7a42f514`.

### Immediate Actions Required

#### 1. Rotate Database Credentials (URGENT - DO THIS NOW!)

Since the credentials were exposed publicly, they MUST be rotated immediately:

**For Ghost.build (https://ghost.build/docs/):**

1. **Login to Ghost** (if not already logged in):
   ```bash
   ghost login
   ```

2. **List your databases** to find the database ID:
   ```bash
   ghost list
   ```

3. **Rotate the password** using the Ghost CLI:
   ```bash
   ghost password <database-id>
   ```
   This will generate a new password and update it automatically.

4. **Get the new connection string**:
   ```bash
   ghost connect <database-id>
   ```

5. **Update the `DATABASE_URL` in your Netlify environment variables**:
   - Go to: https://app.netlify.com/ → Your Site → Site settings → Environment variables
   - Update `DATABASE_URL` with the new connection string from step 4

**Alternative: Fork and migrate (safest approach)**
```bash
# Fork the database to create a fresh instance with new credentials
ghost fork <database-id>

# Get the new connection string
ghost connect <new-database-id>

# Update your application to use the new connection string
# Then delete the old database once migration is complete
ghost delete <old-database-id>
```

#### 2. Verify No Unauthorized Access

Check your database logs for any unauthorized access:
```bash
# View database logs using Ghost CLI
ghost logs <database-id>
```

You can also connect to the database and check recent activity:
```sql
-- Check recent connections
SELECT * FROM pg_stat_activity WHERE usename = 'tsdbadmin' AND state = 'active';

-- Check for any unusual query patterns
SELECT query, query_start, state 
FROM pg_stat_activity 
WHERE state = 'active' 
AND query NOT LIKE '%pg_stat_activity%';
```

#### 3. Clean Git History (Optional but Recommended)

**WARNING:** This will rewrite git history. Coordinate with your team before proceeding.

```bash
# Install git-filter-repo if not already installed
# brew install git-filter-repo  # macOS
# pip install git-filter-repo   # pip

# Remove the .env file from entire history
git filter-repo --path .env --invert-paths

# Force push to remote (coordinate with team!)
git push origin --force --all
```

**Alternative (if you can't rewrite history):**
The credentials have been exposed. Rotating them is the most important step.

### Security Measures Implemented

The following security measures have been implemented:

1. ✅ `.gitignore` files created at root, web-app/, and extension/ to prevent future accidental commits
2. ✅ `.env` removed from git tracking
3. ✅ `.env.example` created as a safe template
4. ✅ CORS configuration restricted (see below)
5. ✅ This SECURITY.md document created

### Ongoing Security Practices

- [ ] Enable 2FA on all accounts (GitHub, Ghost.build, Netlify)
- [ ] Set up database connection IP allowlisting
- [ ] Enable query logging on the database
- [ ] Set up monitoring for suspicious database activity
- [ ] Review access logs regularly

## CORS Configuration

The API endpoints use CORS headers. For production:

1. Replace wildcard (`*`) with your actual domain:
   ```javascript
   const headers = {
     'Access-Control-Allow-Origin': 'https://your-domain.com',
     // ... other headers
   };
   ```

2. For multiple domains, check the origin dynamically:
   ```javascript
   const allowedOrigins = ['https://your-domain.com', 'https://app.your-domain.com'];
   const origin = event.headers.origin;
   const headers = {
     'Access-Control-Allow-Origin': allowedOrigins.includes(origin) ? origin : allowedOrigins[0],
     // ... other headers
   };
   ```

## Security Checklist for Deployments

Before each deployment, verify:

- [ ] No `.env` files in the commit
- [ ] No hardcoded secrets in code
- [ ] No `console.log` statements with sensitive data
- [ ] All dependencies are up to date (`npm audit`)
- [ ] Environment variables are set in deployment platform

## Useful Security Commands

```bash
# Check for secrets in git history
git log --all --full-history -p | grep -i "password\|secret\|key"

# Scan for common secrets
git log --all --full-history -S "password" --source --name-only

# Check what files are tracked
git ls-files | grep -E "\.(env|key|pem)$"

# Run security audit on dependencies
npm audit
```
