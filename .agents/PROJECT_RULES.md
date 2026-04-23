# Project Rules for posthuman-app

## Auto-Commit & Deployment

### Automatic Git Operations
- **ALWAYS** commit changes immediately after making edits to this project
- **ALWAYS** push commits to GitHub automatically
- **NO** user confirmation required for commits and pushes in this project
- Use detailed commit messages that include:
  - File names changed
  - Line numbers affected (if applicable)
  - What was fixed, added, or changed
  - Why the change was made (if non-obvious)

### Deployment Flow
1. Make changes to code
2. Immediately commit with descriptive message
3. Push to current branch
4. If on `feature/dashboard-redesign`, merge to `main` for deployment
5. GitHub Actions will automatically deploy to GitHub Pages

### Branch Strategy
- Development happens on `feature/dashboard-redesign`
- Production deploys from `main` branch
- GitHub Pages URL: https://antropocosmist.github.io/posthuman-app/

### Commit Message Format
```
<type>(<scope>): <description>

[optional body with details]
```

Types: feat, fix, refactor, style, docs, chore

Example:
```
feat(dashboard): add real-time balance updates

- Modified Dashboard.tsx lines 45-67
- Added useEffect hook for polling
- Integrated with refreshBalances from walletStore
```

## Development Rules

### Testing
- Never open browser automatically
- Never run dev server in terminal commands
- User tests manually at localhost:3000 (hot reload active)

### Code Style
- Use TypeScript strict mode
- Follow existing Tailwind CSS patterns
- Use Framer Motion for animations
- Maintain responsive design (mobile + desktop)

### Dependencies
- Multi-chain support: EVM, Cosmos, Solana
- State management: Zustand
- Routing: React Router v7
- UI: Tailwind + Framer Motion + Lucide icons

## Project Context

This is a multi-chain crypto wallet application with:
- Dashboard for portfolio overview
- Trade page for cross-chain swaps (Skip Protocol)
- Wallet management (connect/disconnect)
- Send/Receive functionality
- Support for 10+ blockchain networks