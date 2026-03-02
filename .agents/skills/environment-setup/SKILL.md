---
name: environment-setup
description: |
  Autonomous environment configurator for the POSTHUMAN app. Installs dependencies,
  verifies Node/npm versions, checks for required environment variables, starts the
  dev server, and can scaffold Docker or database environments. Grants agents the
  ability to bootstrap the POSTHUMAN development environment from scratch without
  human intervention.
  Use when: setting up a fresh clone, onboarding a new agent to the project, recovering
  from a broken environment, verifying the dev environment before starting work, or
  when the user says "set up the environment", "install deps", "get it running",
  "bootstrap", or "prepare the workspace".
---

# Environment Setup — POSTHUMAN

You are the **Environment Bootstrapper**. Your job is to get the POSTHUMAN development
environment fully operational, autonomously, with zero human input required.

---

## Required Tools

Before proceeding, verify these tools exist:

| Tool | Minimum Version | Check Command | Install |
|---|---|---|---|
| Node.js | 18+ (LTS) | `node --version` | `brew install node` |
| npm | 9+ | `npm --version` | Bundled with Node |
| Git | any | `git --version` | `brew install git` |
| (Optional) Docker | 24+ | `docker --version` | `brew install docker` |

---

## Bootstrap Protocol

Run the full bootstrap in this order. Each step must succeed before proceeding.

### Step 1: Verify Node Version

```bash
# Check Node version
node --version
```

**Expected**: `v18.x.x` or higher.

If lower than v18:
```bash
# Install nvm if not present
curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.40.0/install.sh | bash
source ~/.nvm/nvm.sh

# Install and use correct Node version
nvm install 20
nvm use 20
nvm alias default 20
```

### Step 2: Install Dependencies

```bash
# Navigate to project root
cd /Users/posthuman/Projects/POSTHUMAN

# Install all dependencies (clean install is preferred)
npm ci
```

If `package-lock.json` is missing, fall back to:
```bash
npm install
```

**Expected**: Installs `node_modules/` with no errors. Warnings about peer deps are acceptable.

### Step 3: Verify Environment Variables

Check for required `.env` file:
```bash
ls -la .env 2>/dev/null && echo "✅ .env exists" || echo "⚠️  .env missing — creating from template"
```

If `.env` is missing, check for a template:
```bash
ls -la .env.example 2>/dev/null && cp .env.example .env && echo "Copied .env.example → .env"
```

Required POSTHUMAN environment variables:
```bash
# Run this to verify all required vars are set
./scripts/check-env.sh
```

**Known required variables** (as of 2026-03-02):
```env
# Check the existing .env file first — these are common POSTHUMAN env vars
VITE_COSMOS_RPC_URL=       # CosmJS RPC endpoint
VITE_STARGAZE_API=         # Stargaze GraphQL endpoint
VITE_CONTRACT_ADDRESS=     # POSTHUMAN smart contract address
VITE_CHAIN_ID=             # Cosmos chain ID
```

> [!WARNING]
> Never hardcode RPC URLs or contract addresses in source files.
> Always use `import.meta.env.VITE_*` variables in Vite apps.

### Step 4: TypeScript Check

```bash
# Verify no TypeScript compilation errors
npx tsc --noEmit 2>&1 | head -30
```

**Expected**: Clean output (no errors). Fix any errors before proceeding.

### Step 5: Start Dev Server

```bash
npm run dev
```

**Expected output**:
```
  VITE v7.x.x  ready in Xms

  ➜  Local:   http://localhost:5173/
  ➜  Network: ...
```

Verify the app loads in browser at `http://localhost:5173`

### Step 6: Run Lint Check

```bash
npm run lint
```

**Expected**: No errors. Warnings are acceptable.

---

## Troubleshooting Common Issues

### `npm ci` fails — lockfile mismatch
```bash
# Delete node_modules and lockfile, reinstall fresh
rm -rf node_modules package-lock.json
npm install
```

### Port 5173 already in use
```bash
# Kill existing Vite process
lsof -ti:5173 | xargs kill -9 2>/dev/null
npm run dev
```

### TypeScript errors after pulling changes
```bash
# Common fix: types are outdated
npm install
npx tsc --noEmit
```

### `Cannot find module` errors in browser
```bash
# Vite alias issues — check vite.config.ts for path aliases
cat vite.config.ts
```

### CosmJS / Solana wallet not connecting in dev
```bash
# This is usually a CORS or RPC issue — check env vars
echo $VITE_COSMOS_RPC_URL
# Also check browser console for CORS errors
```

### `gh-pages` deploy fails
```bash
# Ensure git remote is set correctly
git remote -v
# Run build first to check for errors
npm run build 2>&1 | tail -20
```

---

## Docker Environment (Optional)

If you need a containerized environment (e.g., for CI or isolated testing):

```bash
# Check if docker-compose.yml exists
ls -la docker-compose.yml 2>/dev/null || echo "No docker-compose.yml found"

# If exists, bring up services
docker compose up -d

# Check service status
docker compose ps
docker compose logs --tail=20
```

If no `docker-compose.yml` exists, create a minimal one for the frontend dev server:

```yaml
# docker-compose.yml
version: '3.8'
services:
  frontend:
    image: node:20-alpine
    working_dir: /app
    volumes:
      - .:/app
      - /app/node_modules
    ports:
      - "5173:5173"
    command: sh -c "npm ci && npm run dev -- --host 0.0.0.0"
    environment:
      - NODE_ENV=development
```

---

## Full Environment Health Check

Run the bundled script for a complete status report:

```bash
./scripts/check-env.sh
```

This script checks:
- Node/npm versions
- `node_modules` presence
- Required env variables
- TypeScript errors
- Lint status
- Dev server reachability

---

## References

- See `scripts/check-env.sh` for the automated health check script
- See `tech-stack-master` skill for full tech stack documentation
- See `legacy-code-auditor` skill to audit code after environment is running
