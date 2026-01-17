#!/usr/bin/env bash
#
# speckit-dashboard.sh - Start the SpecKit web dashboard
#
# Usage: speckit dashboard [OPTIONS]
#
# Options:
#   --dev       Run in development mode (hot reload)
#   --port N    Use specific port (default: 4200)
#   -h, --help  Show this help
#

set -euo pipefail

# Determine script directory
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
readonly SCRIPT_DIR

# Source common library
source "${SCRIPT_DIR}/lib/common.sh"

# Dashboard directory (relative to SpecKit install)
DASHBOARD_DIR="${SCRIPT_DIR}/../../packages/dashboard"
readonly DASHBOARD_DIR

# Default values
DEV_MODE=false
PORT=4200

show_help() {
  cat << 'EOF'
speckit dashboard - Start the SpecKit web dashboard

USAGE:
    speckit dashboard [OPTIONS]

OPTIONS:
    --dev       Run in development mode (hot reload)
    --port N    Use specific port (default: 4200)
    -h, --help  Show this help

EXAMPLES:
    speckit dashboard           # Start production server on port 4200
    speckit dashboard --dev     # Start dev server with hot reload
    speckit dashboard --port 8080  # Use port 8080
EOF
}

check_dependencies() {
  if ! command -v node >/dev/null 2>&1; then
    log_error "Node.js not found"
    log_info "Install Node.js 18+ from: https://nodejs.org"
    log_info "  macOS: brew install node"
    log_info "  Linux: See https://nodejs.org/en/download/"
    exit 1
  fi

  local node_version
  node_version=$(node --version | sed 's/v//' | cut -d. -f1)
  if [[ "$node_version" -lt 18 ]]; then
    log_error "Node.js 18+ required (found v${node_version})"
    exit 1
  fi

  if ! command -v pnpm >/dev/null 2>&1; then
    log_error "pnpm not found"
    log_info "Install pnpm: npm install -g pnpm"
    exit 1
  fi
}

find_available_port() {
  local start_port=$1
  local port=$start_port

  while [[ $port -le $((start_port + 10)) ]]; do
    if ! lsof -Pi :$port -sTCP:LISTEN -t >/dev/null 2>&1; then
      echo "$port"
      return 0
    fi
    ((port++))
  done

  # Couldn't find available port
  echo "$start_port"
  return 1
}

main() {
  # Parse arguments
  while [[ $# -gt 0 ]]; do
    case "$1" in
      --dev)
        DEV_MODE=true
        shift
        ;;
      --port)
        PORT="$2"
        shift 2
        ;;
      -h|--help)
        show_help
        exit 0
        ;;
      *)
        log_error "Unknown option: $1"
        show_help
        exit 1
        ;;
    esac
  done

  # Check dependencies
  check_dependencies

  # Verify dashboard exists
  if [[ ! -d "$DASHBOARD_DIR" ]]; then
    log_error "Dashboard not found at $DASHBOARD_DIR"
    log_info "Ensure SpecKit is properly installed"
    exit 1
  fi

  # Find available port if default is in use
  local actual_port
  actual_port=$(find_available_port "$PORT")
  if [[ "$actual_port" != "$PORT" ]]; then
    log_warn "Port $PORT in use, using $actual_port instead"
  fi

  # Get workspace root (parent of packages directory)
  local workspace_root
  workspace_root="$(dirname "$(dirname "$DASHBOARD_DIR")")"

  # Install dependencies if needed (must run from workspace root for pnpm workspaces)
  if [[ ! -d "${DASHBOARD_DIR}/node_modules" ]]; then
    log_info "Installing dependencies..."
    cd "$workspace_root"
    pnpm install
  fi

  # Change to dashboard directory
  cd "$DASHBOARD_DIR"

  # Start server
  if [[ "$DEV_MODE" == "true" ]]; then
    log_info "Starting dashboard (dev mode) on http://localhost:$actual_port"
    exec pnpm dev --port "$actual_port"
  else
    log_info "Building dashboard..."
    pnpm build

    log_info "Starting dashboard on http://localhost:$actual_port"
    exec pnpm start --port "$actual_port"
  fi
}

main "$@"
