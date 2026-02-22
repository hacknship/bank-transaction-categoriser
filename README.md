# Maybank Budget Tracker

Chrome extension + serverless web app for categorizing Maybank transactions in real-time with budget tracking and monthly reconciliation.

## Features

- ✅ Inline transaction categorization with keyboard navigation
- ✅ Multi-account detection (2+ Maybank accounts)
- ✅ Custom budget categories with monthly budget limits
- ✅ Monthly budget reconciliation (vs actual spending)
- ✅ Budget archive (track budget changes over time)
- ✅ Bank balance verification

## Tech Stack

| Component | Technology | Cost |
|-----------|------------|------|
| Extension | Chrome Extension API | $0 |
| Frontend | React + Vite | Netlify (free) |
| Backend | Netlify Functions | Free tier |
| Database | Ghost.build PostgreSQL | Free (1TB, 100 hrs/mo) |

## Quick Start

### 1. Database Setup (Ghost.build)

```bash
# Install Ghost CLI
curl -fsSL https://install.ghost.build | sh

# Login with GitHub
ghost login

# Create database
ghost db create --name maybank-budget

# Get connection string
ghost db info maybank-budget
```

### 2. Environment Setup

Create `.env` in project root:

```
GHOST_DB_URL=postgresql://user:pass@host:port/maybank-budget
```

### 3. Initialize Database

```bash
psql $GHOST_DB_URL < schema.sql
```

### 4. Install Dependencies

```bash
# Root dependencies
npm install

# Web app dependencies
cd web-app && npm install
```

### 5. Netlify Setup

```bash
npm install -g netlify-cli
netlify login
netlify init

# Set environment variable
netlify env:set GHOST_DB_URL $GHOST_DB_URL
```

### 6. Development

```bash
# Start Netlify dev server (runs web app + functions)
npm run netlify:dev

# Or run web app only
cd web-app && npm run dev
```

### 7. Chrome Extension

1. Open Chrome and go to `chrome://extensions`
2. Enable "Developer mode"
3. Click "Load unpacked"
4. Select the `extension/` folder
5. Navigate to Maybank website to test

## Project Structure

```
maybank-budget-tracker/
├── extension/              # Chrome Extension
│   ├── manifest.json
│   ├── content.js          # Content script for Maybank page
│   ├── content.css
│   ├── popup.html
│   └── popup.js
├── netlify/functions/      # Serverless API
│   ├── detect-account.js
│   ├── save-transaction.js
│   ├── get-transactions.js
│   ├── set-budget.js
│   ├── get-budget.js
│   ├── get-reconcile.js
│   └── archive-budget.js
├── web-app/                # React Dashboard
│   ├── src/
│   │   ├── pages/
│   │   │   ├── Dashboard.jsx
│   │   │   ├── Budget.jsx
│   │   │   ├── Transactions.jsx
│   │   │   └── Reconcile.jsx
│   │   ├── utils/
│   │   │   └── api.js
│   │   ├── App.jsx
│   │   └── main.jsx
│   ├── index.html
│   └── package.json
├── schema.sql              # Database schema
├── netlify.toml            # Netlify config
└── README.md
```

## Database Schema

### Tables

- **accounts** - Store account information and balances
- **transactions** - Categorized transactions with SHA-256 IDs
- **budget_categories** - Monthly budget limits per category
- **budget_history** - Archived budget performance
- **balance_snapshots** - Historical balance tracking

## API Endpoints

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/detect-account` | POST | Register/update account info |
| `/save-transaction` | POST | Save categorized transaction |
| `/get-transactions` | GET | Fetch transactions with filters |
| `/set-budget` | POST | Create/update budget category |
| `/get-budget` | GET | Get current month budget |
| `/get-reconcile` | GET | Bank balance vs spend comparison |
| `/archive-budget` | POST | Archive monthly budget |

## Keyboard Shortcuts

| Key | Action |
|-----|--------|
| ↑ / ↓ | Navigate between transaction rows |
| ← / → | Switch between CATEGORY and NOTES columns |
| Enter | Focus/select the current cell (opens dropdown for category) |
| Space | Open category dropdown (when category column selected) |
| Esc | Clear focus/Deactivate keyboard navigation |
| Cmd/Ctrl + . | Go to next page of transactions |
| Cmd/Ctrl + , | Go to previous page of transactions |

### Usage Tips
1. Press **Arrow Down** to start keyboard navigation (highlights first row)
2. Use **Arrow Keys** to move between cells
3. Press **Enter** or **Space** to open category dropdown
4. Press **Esc** to exit keyboard navigation at any time
5. Use **Cmd/Ctrl + .** or **Cmd/Ctrl + ,** to navigate pages without mouse

## Deployment

```bash
# Deploy to Netlify
netlify deploy --prod

# Update Chrome Extension
# Zip the extension folder and upload to Chrome Web Store
```

## Configuration

### Chrome Extension

Update `extension/content.js`:
```javascript
const CONFIG = {
  API_BASE_URL: 'https://your-site.netlify.app/.netlify/functions',
  // ...
};
```

### Update `extension/popup.js`:
```javascript
const dashboardUrl = 'https://your-site.netlify.app';
```

## Cost Analysis

| Service | Free Tier | Limit | Cost |
|---------|-----------|-------|------|
| Ghost.build PostgreSQL | Yes | 1TB storage, 100 hrs/mo | $0 |
| Netlify Functions | Yes | 125k invocations/month | $0 |
| Netlify Hosting | Yes | 100GB bandwidth | $0 |
| Chrome Extension | Yes | Unlimited | $0 |

**Total: $0/month** ✅

## License

MIT
