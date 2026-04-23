---
description: Never hardcode API keys or secrets - always use GitHub Secrets
---

# No Hardcoded Keys Workflow

**CRITICAL SECURITY RULE**: Never add API keys, tokens, passwords, or any sensitive credentials directly to code files.

## When API Keys or Secrets Are Needed

### 1. Identify the Required Secret
Determine what secret is needed (e.g., API key, access token, database password).

### 2. Ask User to Create GitHub Secret
**STOP and ask the user** to create a GitHub Secret with the following information:
- **Secret name**: Suggest a descriptive name in SCREAMING_SNAKE_CASE (e.g., `OPENSEA_API_KEY`, `SUPABASE_ANON_KEY`)
- **Purpose**: Explain what the secret is for
- **Where to add it**: GitHub repository → Settings → Secrets and variables → Actions → New repository secret

### 3. Reference the Secret in Code
Once the user confirms the secret is created, reference it using environment variables:

**For Vite projects:**
```typescript
const apiKey = import.meta.env.VITE_API_KEY;
```

**For GitHub Actions:**
```yaml
env:
  API_KEY: ${{ secrets.API_KEY_NAME }}
```

### 4. Update .env.example (if applicable)
Add a placeholder entry to `.env.example` to document the required variable:
```
VITE_API_KEY=your_api_key_here
```

### 5. Verify .gitignore
Ensure `.env`, `.env.local`, and similar files are in `.gitignore` to prevent accidental commits.

## Examples of Secrets to NEVER Hardcode
- API keys (OpenSea, Alchemy, Infura, etc.)
- Database credentials
- Private keys or mnemonics
- OAuth tokens
- Service account credentials
- Encryption keys
- Webhook secrets

## What CAN Be Hardcoded
- Public RPC endpoints (if truly public)
- Contract addresses (public on blockchain)
- Chain IDs
- Public configuration values
