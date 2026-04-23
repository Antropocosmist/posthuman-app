#!/usr/bin/env bash
# =============================================================================
# POSTHUMAN Environment Health Check
# Usage: ./scripts/check-env.sh
# =============================================================================

set -e

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

ERRORS=0
WARNINGS=0

echo ""
echo -e "${BLUE}════════════════════════════════════════${NC}"
echo -e "${BLUE}   POSTHUMAN Environment Health Check   ${NC}"
echo -e "${BLUE}════════════════════════════════════════${NC}"
echo ""

# ─── Helper functions ──────────────────────────────────────────────────────

check_ok()  { echo -e "  ${GREEN}✅ $1${NC}"; }
check_warn(){ echo -e "  ${YELLOW}⚠️  $1${NC}"; WARNINGS=$((WARNINGS+1)); }
check_err() { echo -e "  ${RED}❌ $1${NC}"; ERRORS=$((ERRORS+1)); }

# ─── Section 1: System Tools ───────────────────────────────────────────────

echo -e "${BLUE}── System Tools ──────────────────────────${NC}"

# Node.js
if command -v node >/dev/null 2>&1; then
  NODE_VERSION=$(node --version | sed 's/v//')
  NODE_MAJOR=$(echo "$NODE_VERSION" | cut -d. -f1)
  if [ "$NODE_MAJOR" -ge 18 ]; then
    check_ok "Node.js v$NODE_VERSION (✓ ≥ 18)"
  else
    check_err "Node.js v$NODE_VERSION is too old — requires v18+"
  fi
else
  check_err "Node.js not found — install via: brew install node"
fi

# npm
if command -v npm >/dev/null 2>&1; then
  NPM_VERSION=$(npm --version)
  NPM_MAJOR=$(echo "$NPM_VERSION" | cut -d. -f1)
  if [ "$NPM_MAJOR" -ge 9 ]; then
    check_ok "npm v$NPM_VERSION (✓ ≥ 9)"
  else
    check_warn "npm v$NPM_VERSION is old — consider upgrading: npm install -g npm@latest"
  fi
else
  check_err "npm not found"
fi

# Git
if command -v git >/dev/null 2>&1; then
  GIT_VERSION=$(git --version | awk '{print $3}')
  check_ok "git v$GIT_VERSION"
else
  check_warn "git not found — install via: brew install git"
fi

# Docker (optional)
if command -v docker >/dev/null 2>&1; then
  DOCKER_VERSION=$(docker --version | awk '{print $3}' | sed 's/,//')
  check_ok "docker v$DOCKER_VERSION (optional)"
else
  check_warn "docker not found (optional — only needed for containerized workflows)"
fi

echo ""

# ─── Section 2: Project Dependencies ──────────────────────────────────────

echo -e "${BLUE}── Project Dependencies ──────────────────${NC}"

PROJECT_ROOT="$(cd "$(dirname "$0")/.." && pwd)"

if [ -f "$PROJECT_ROOT/package.json" ]; then
  check_ok "package.json found"
else
  check_err "package.json not found — are you in the right directory?"
fi

if [ -d "$PROJECT_ROOT/node_modules" ]; then
  check_ok "node_modules exists"
else
  check_err "node_modules missing — run: npm install"
fi

if [ -f "$PROJECT_ROOT/package-lock.json" ]; then
  check_ok "package-lock.json exists"
else
  check_warn "package-lock.json missing — run: npm install to generate it"
fi

echo ""

# ─── Section 3: Environment Variables ─────────────────────────────────────

echo -e "${BLUE}── Environment Variables ────────────────${NC}"

if [ -f "$PROJECT_ROOT/.env" ]; then
  check_ok ".env file exists"
elif [ -f "$PROJECT_ROOT/.env.example" ]; then
  check_warn ".env missing — copying from .env.example (you may need to fill in values)"
  cp "$PROJECT_ROOT/.env.example" "$PROJECT_ROOT/.env"
else
  check_warn ".env file not found — create one with required VITE_* variables"
fi

# Check known VITE_ variables (non-blocking, warn only)
if [ -f "$PROJECT_ROOT/.env" ]; then
  REQUIRED_VARS=(
    "VITE_COSMOS_RPC_URL"
    "VITE_CHAIN_ID"
  )
  for var in "${REQUIRED_VARS[@]}"; do
    if grep -q "^${var}=" "$PROJECT_ROOT/.env" && [ -n "$(grep "^${var}=" "$PROJECT_ROOT/.env" | cut -d= -f2-)" ]; then
      check_ok "$var is set"
    else
      check_warn "$var is not set in .env"
    fi
  done
fi

echo ""

# ─── Section 4: TypeScript ────────────────────────────────────────────────

echo -e "${BLUE}── TypeScript ───────────────────────────${NC}"

if command -v npx >/dev/null 2>&1 && [ -f "$PROJECT_ROOT/tsconfig.json" ]; then
  TSC_OUTPUT=$(cd "$PROJECT_ROOT" && npx tsc --noEmit 2>&1 | head -5)
  if [ -z "$TSC_OUTPUT" ]; then
    check_ok "TypeScript compilation — no errors"
  else
    check_warn "TypeScript has errors (first 5 lines):"
    echo "$TSC_OUTPUT" | while IFS= read -r line; do
      echo -e "    ${YELLOW}$line${NC}"
    done
    WARNINGS=$((WARNINGS+1))
  fi
else
  check_warn "TypeScript check skipped (no tsconfig.json or npx not available)"
fi

echo ""

# ─── Section 5: Port Availability ─────────────────────────────────────────

echo -e "${BLUE}── Port Availability ────────────────────${NC}"

if lsof -Pi :5173 -sTCP:LISTEN -t >/dev/null 2>&1; then
  check_warn "Port 5173 is already in use — Vite dev server may already be running"
else
  check_ok "Port 5173 is available (Vite dev server can start)"
fi

echo ""

# ─── Summary ──────────────────────────────────────────────────────────────

echo -e "${BLUE}════════════════════════════════════════${NC}"
if [ $ERRORS -eq 0 ] && [ $WARNINGS -eq 0 ]; then
  echo -e "${GREEN}  ✅ All checks passed! Run: npm run dev${NC}"
elif [ $ERRORS -eq 0 ]; then
  echo -e "${YELLOW}  ⚠️  $WARNINGS warning(s) — environment mostly ready${NC}"
  echo -e "${YELLOW}     Run: npm run dev${NC}"
else
  echo -e "${RED}  ❌ $ERRORS error(s) and $WARNINGS warning(s) found${NC}"
  echo -e "${RED}     Fix errors above before starting the dev server${NC}"
fi
echo -e "${BLUE}════════════════════════════════════════${NC}"
echo ""

[ $ERRORS -eq 0 ]  # Exit with error code if there were errors
