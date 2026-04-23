# Security Rules

> [!IMPORTANT]
> **NEVER add any API keys, secrets, or credentials directly into the code.**

## Protocol
1.  **Detection**: If a task requires an API key or secret.
2.  **Action**: Do NOT write it to a file (like `config.ts` or `.env` committed to git).
3.  **Request**: Ask the user to:
    *   Create a **Repository Secret** on GitHub.
    *   Add the secret to their local `.env` file (which must be git-ignored).
4.  **Implementation**: Access the secret in code via environment variables (e.g., `import.meta.env.VITE_MY_SECRET`).

## Remediation
If a key is accidentally committed:
1.  **Rotate** the key immediately.
2.  **Remove** the key from code.
3.  **Revoke** the old key.

# Process Rules

> [!IMPORTANT]
> **ALWAYS push updates to GitHub.**

1.  **Sync**: The "live" site is the source of truth for the user.
2.  **Push**: After every meaningful set of changes (especially fixes), push to the repository.
3.  **Verify**: Ensure the build passes before pushing (or let CI catch it, but better to check locally).
