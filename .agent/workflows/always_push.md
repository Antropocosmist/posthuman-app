---
description: Ensure all code changes are committed and pushed to GitHub with logging
---

# Always Push to GitHub Workflow

// turbo-all

This workflow enforces the rule that **every** successful code modification or feature implementation must be committed and pushed to the remote repository. This ensures a persistent log of all changes and allows for rollback/collaboration.

## 1. Verify Build
Before pushing, ensure the project builds successfully to avoid breaking the main branch.

```bash
npm run build
```

## 2. Commit Changes
Stage all modified files and create a semantic commit message. Use `fix:`, `feat:`, `chore:`, `refactor:`, etc.

```bash
git add .
git commit -m "<type>(<scope>): <concise description of changes>"
```

## 3. Push to Remote
Push the changes to the `main` branch (or current active branch).

```bash
git push origin main
```

## 4. Log the Action
Ensure the action is recorded in the `task.md` or `walkthrough.md` as "Push to GitHub" or similar, so the user has a visible log in the conversation artifacts.
