# 🔒 API Security Setup - Deployment Guide

## Summary

All your API endpoints are now protected with authentication. Here's what was done:

### API Keys Generated

**⚠️ SAVE THESE KEYS - You'll need them for deployment!**

| Key | Value | Purpose |
|-----|-------|---------|
| **API_KEY** | `095a8898406ee59062c190385571917488588231e8a1492677f4d7ca8c56185c` | Main key for web app & extension |
| **HEALTH_CHECK_KEY** | `04ce0460e57578a6cb49f0d8868fbeb0fbf1062e36a2af27ce5d5691189fb6e6` | Uptime monitoring only |

---

## Deployment Steps

### 1. Set Environment Variables in Netlify

You need to add these environment variables to your Netlify site:

```bash
# Go to your project folder and link to Netlify (if not already linked)
netlify login
netlify link

# Set the environment variables
netlify env:set API_KEY "095a8898406ee59062c190385571917488588231e8a1492677f4d7ca8c56185c"
netlify env:set HEALTH_CHECK_KEY "04ce0460e57578a6cb49f0d8868fbeb0fbf1062e36a2af27ce5d5691189fb6e6"

# Verify they're set
netlify env:list
```

**Or manually via Netlify Dashboard:**
1. Go to [app.netlify.com](https://app.netlify.com)
2. Select your site
3. Go to **Site settings** → **Environment variables**
4. Add:
   - `API_KEY` = `095a8898406ee59062c190385571917488588231e8a1492677f4d7ca8c56185c`
   - `HEALTH_CHECK_KEY` = `04ce0460e57578a6cb49f0d8868fbeb0fbf1062e36a2af27ce5d5691189fb6e6`

---

### 2. Deploy the Updated Functions

```bash
# Deploy to Netlify
netlify deploy --prod
```

---

### 3. Set Web App Environment Variable

For local development, create `/web-app/.env.local`:

```bash
VITE_API_KEY=095a8898406ee59062c190385571917488588231e8a1492677f4d7ca8c56185c
```

**For production:** The web app will use the API key that's baked in at build time. You need to set it in Netlify before building:

```bash
netlify env:set VITE_API_KEY "095a8898406ee59062c190385571917488588231e8a1492677f4d7ca8c56185c"
```

Then trigger a new deploy.

---

### 4. Update Chrome Extension

The extension has been updated with the API key. You need to reload it:

1. Go to `chrome://extensions`
2. Find "Maybank Budget Tracker"
3. Click the refresh icon 🔄 (or toggle Developer mode off and on)
4. **Important:** The API key is hardcoded in `extension/content.js` line 13

---

## UptimeRobot Setup (Keep Database Alive)

Set up UptimeRobot to ping your database every 24 hours:

### Configuration:
- **Monitor Type:** HTTP(s)
- **Friendly Name:** Maybank DB Keep-Alive
- **URL:** `https://ss-transactions-tracker.netlify.app/.netlify/functions/get-categories?key=04ce0460e57578a6cb49f0d8868fbeb0fbf1062e36a2af27ce5d5691189fb6e6`
- **Monitoring Interval:** Every 24 hours (1440 minutes)

**Note:** The URL includes the `HEALTH_CHECK_KEY`, not the main `API_KEY`. This is intentional - the health check key only works on read-only endpoints.

---

## Security Summary

### Protected Endpoints

All endpoints now require authentication:

| Endpoint | Method | Health Key Allowed? |
|----------|--------|---------------------|
| `/get-categories` | GET | ✅ Yes |
| `/get-transactions` | GET | ✅ Yes |
| `/get-budget` | GET | ✅ Yes |
| `/get-reconcile` | GET | ✅ Yes |
| `/get-budget-history` | GET | ✅ Yes |
| `/get-transaction-totals` | GET | ✅ Yes |
| `/get-available-periods` | GET | ✅ Yes |
| `/get-budget-for-period` | GET | ✅ Yes |
| `/save-transaction` | POST | ❌ No |
| `/save-category` | POST | ❌ No |
| `/delete-category` | POST | ❌ No |
| `/delete-transaction` | POST | ❌ No |
| `/set-budget` | POST | ❌ No |
| `/archive-budget` | POST | ❌ No |
| `/merge-categories` | POST | ❌ No |
| `/update-budget-template` | POST | ❌ No |
| `/update-snapshot-budget` | POST | ❌ No |

### How Authentication Works

1. **Web App:** Sends API key via query parameter (`?key=XXX`) on every request
2. **Extension:** Sends API key via query parameter on every request
3. **UptimeRobot:** Sends `HEALTH_CHECK_KEY` via query parameter
4. **API Functions:** Verify the key before processing any request

---

## Testing After Deployment

### Test Without Key (Should Fail):
```bash
curl https://ss-transactions-tracker.netlify.app/.netlify/functions/get-categories
# Expected: 401 Unauthorized
```

### Test With Health Key (Should Work):
```bash
curl "https://ss-transactions-tracker.netlify.app/.netlify/functions/get-categories?key=04ce0460e57578a6cb49f0d8868fbeb0fbf1062e36a2af27ce5d5691189fb6e6"
# Expected: 200 OK with categories JSON
```

### Test With Main API Key (Should Work):
```bash
curl "https://ss-transactions-tracker.netlify.app/.netlify/functions/get-categories?key=095a8898406ee59062c190385571917488588231e8a1492677f4d7ca8c56185c"
# Expected: 200 OK with categories JSON
```

### Test Write Operation With Health Key (Should Fail):
```bash
curl -X POST "https://ss-transactions-tracker.netlify.app/.netlify/functions/save-transaction?key=04ce0460e57578a6cb49f0d8868fbeb0fbf1062e36a2af27ce5d5691189fb6e6" \
  -H "Content-Type: application/json" \
  -d '{}'
# Expected: 401 Unauthorized (health key not allowed for writes)
```

---

## Files Modified

1. **`netlify/functions/utils/auth.js`** (NEW) - Authentication utility
2. **`netlify/functions/get-categories.js`** - Added auth check (allows health key)
3. **`netlify/functions/get-transactions.js`** - Added auth check (allows health key)
4. **`netlify/functions/get-budget.js`** - Added auth check (allows health key)
5. **`netlify/functions/get-reconcile.js`** - Added auth check (allows health key)
6. **`netlify/functions/get-budget-history.js`** - Added auth check (allows health key)
7. **`netlify/functions/get-transaction-totals.js`** - Added auth check (allows health key)
8. **`netlify/functions/get-available-periods.js`** - Added auth check (allows health key)
9. **`netlify/functions/get-budget-for-period.js`** - Added auth check (allows health key)
10. **`netlify/functions/list-tables.js`** - Added auth check (allows health key)
11. **`netlify/functions/detect-account.js`** - Added auth check (allows health key)
12. **`netlify/functions/debug-budget.js`** - Added auth check (allows health key)
13. **`netlify/functions/debug-schema.js`** - Added auth check (allows health key)
14. **`netlify/functions/save-transaction.js`** - Added auth check (no health key)
15. **`netlify/functions/save-category.js`** - Added auth check (no health key)
16. **`netlify/functions/delete-category.js`** - Added auth check (no health key)
17. **`netlify/functions/delete-transaction.js`** - Added auth check (no health key)
18. **`netlify/functions/set-budget.js`** - Added auth check (no health key)
19. **`netlify/functions/archive-budget.js`** - Added auth check (no health key)
20. **`netlify/functions/merge-categories.js`** - Added auth check (no health key)
21. **`netlify/functions/update-budget-template.js`** - Added auth check (no health key)
22. **`netlify/functions/update-snapshot-budget.js`** - Added auth check (no health key)
23. **`web-app/src/utils/api.js`** - Updated to send API key
24. **`extension/content.js`** - Updated to send API key

---

## ⚠️ Important Notes

1. **The API keys are now in your code** (in `extension/content.js`). This is acceptable for a personal/family tool, but for production apps, you'd want a more sophisticated auth system.

2. **Anyone with the extension can see the API key** - but it's the same risk as before with the password gate. The keys protect against external API abuse.

3. **After deploying, your wife will need to refresh the page** to get the new web app with API key support.

4. **If you ever need to rotate the keys:**
   - Generate new keys
   - Update Netlify environment variables
   - Update `extension/content.js` line 13
   - Update `web-app/.env.local` for local dev
   - Re-deploy everything
