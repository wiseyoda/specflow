#!/usr/bin/env bash
#
# SpecKit Installation Script
#
# Usage:
#   curl -fsSL https://raw.githubusercontent.com/USER/claude-speckit-orchestration/main/install.sh | bash
#   or
#   ./install.sh
#
# Options:
#   --upgrade     Upgrade existing installation
#   --uninstall   Remove SpecKit
#   --check       Check installation status
#

set -euo pipefail

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[0;33m'
BLUE='\033[0;34m'
BOLD='\033[1m'
RESET='\033[0m'

# Paths
SPECKIT_HOME="${HOME}/.claude/speckit-system"
SPECKIT_BIN="${SPECKIT_HOME}/bin"
SPECKIT_COMMANDS="${HOME}/.claude/commands"
REPO_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

log_info() { echo -e "${BLUE}INFO${RESET}: $*"; }
log_success() { echo -e "${GREEN}OK${RESET}: $*"; }
log_warn() { echo -e "${YELLOW}WARN${RESET}: $*"; }
log_error() { echo -e "${RED}ERROR${RESET}: $*" >&2; }
log_step() { echo -e "${BLUE}==>${RESET} ${BOLD}$*${RESET}"; }

print_banner() {
  echo ""
  echo -e "${BOLD}╔════════════════════════════════════════════════╗${RESET}"
  echo -e "${BOLD}║              SpecKit Installer                 ║${RESET}"
  echo -e "${BOLD}║   Spec-Driven Development for Claude Code     ║${RESET}"
  echo -e "${BOLD}╚════════════════════════════════════════════════╝${RESET}"
  echo ""
}

check_dependencies() {
  log_step "Checking dependencies"

  local missing=0

  # Check for jq
  if command -v jq &>/dev/null; then
    log_success "jq found: $(jq --version)"
  else
    log_warn "jq not found (required for JSON operations)"
    echo "  Install with: brew install jq (macOS) or apt install jq (Linux)"
    missing=1
  fi

  # Check for git
  if command -v git &>/dev/null; then
    log_success "git found: $(git --version | head -1)"
  else
    log_error "git not found (required)"
    missing=1
  fi

  # Check for Claude Code
  if [[ -d "${HOME}/.claude" ]]; then
    log_success "Claude Code directory found"
  else
    log_warn "~/.claude not found - will be created"
  fi

  return $missing
}

check_existing() {
  if [[ -d "$SPECKIT_HOME" ]]; then
    return 0  # Exists
  else
    return 1  # Doesn't exist
  fi
}

get_installed_version() {
  if [[ -f "${SPECKIT_HOME}/VERSION" ]]; then
    cat "${SPECKIT_HOME}/VERSION"
  else
    echo "unknown"
  fi
}

get_repo_version() {
  if [[ -f "${REPO_DIR}/VERSION" ]]; then
    cat "${REPO_DIR}/VERSION"
  else
    echo "1.0.0"
  fi
}

install_speckit() {
  local upgrade="${1:-false}"

  if [[ "$upgrade" == "true" ]]; then
    log_step "Upgrading SpecKit"
  else
    log_step "Installing SpecKit"
  fi

  # Create directories
  mkdir -p "$SPECKIT_HOME"/{bin,scripts/bash/lib,templates}
  mkdir -p "$SPECKIT_COMMANDS"

  # Copy CLI
  log_info "Installing CLI..."
  cp "${REPO_DIR}/bin/speckit" "${SPECKIT_BIN}/speckit"
  chmod +x "${SPECKIT_BIN}/speckit"

  # Copy scripts
  log_info "Installing scripts..."
  cp "${REPO_DIR}/scripts/bash/lib/"*.sh "${SPECKIT_HOME}/scripts/bash/lib/"
  cp "${REPO_DIR}/scripts/bash/"*.sh "${SPECKIT_HOME}/scripts/bash/" 2>/dev/null || true
  chmod +x "${SPECKIT_HOME}/scripts/bash/"*.sh 2>/dev/null || true

  # Copy templates
  log_info "Installing templates..."
  cp "${REPO_DIR}/templates/"* "${SPECKIT_HOME}/templates/" 2>/dev/null || true

  # Copy commands (with backup if upgrading)
  log_info "Installing commands..."
  if [[ "$upgrade" == "true" ]]; then
    # Backup existing commands
    local backup_dir="${SPECKIT_COMMANDS}/.backup-$(date +%Y%m%d%H%M%S)"
    mkdir -p "$backup_dir"
    cp "${SPECKIT_COMMANDS}/speckit."*.md "$backup_dir/" 2>/dev/null || true
    log_info "Backed up existing commands to $backup_dir"
  fi

  for cmd in "${REPO_DIR}/commands/"speckit.*.md; do
    if [[ -f "$cmd" ]]; then
      local filename=$(basename "$cmd")
      cp "$cmd" "${SPECKIT_COMMANDS}/${filename}"
    fi
  done

  # Copy utility commands
  for cmd in "${REPO_DIR}/commands/utilities/"speckit.*.md; do
    if [[ -f "$cmd" ]]; then
      local filename=$(basename "$cmd")
      cp "$cmd" "${SPECKIT_COMMANDS}/${filename}"
    fi
  done

  # Copy QUESTION_CATEGORIES
  if [[ -f "${REPO_DIR}/QUESTION_CATEGORIES.md" ]]; then
    cp "${REPO_DIR}/QUESTION_CATEGORIES.md" "${SPECKIT_HOME}/"
  fi

  # Write version file
  get_repo_version > "${SPECKIT_HOME}/VERSION"

  log_success "SpecKit installed to ${SPECKIT_HOME}"
}

setup_path() {
  log_step "Setting up PATH"

  local shell_rc=""
  local shell_name=$(basename "$SHELL")

  case "$shell_name" in
    bash)
      shell_rc="${HOME}/.bashrc"
      [[ -f "${HOME}/.bash_profile" ]] && shell_rc="${HOME}/.bash_profile"
      ;;
    zsh)
      shell_rc="${HOME}/.zshrc"
      ;;
    *)
      log_warn "Unknown shell: $shell_name"
      shell_rc="${HOME}/.profile"
      ;;
  esac

  local path_line='export PATH="$HOME/.claude/speckit-system/bin:$PATH"'

  if grep -q "speckit-system/bin" "$shell_rc" 2>/dev/null; then
    log_info "PATH already configured in $shell_rc"
  else
    echo "" >> "$shell_rc"
    echo "# SpecKit CLI" >> "$shell_rc"
    echo "$path_line" >> "$shell_rc"
    log_success "Added to $shell_rc"
    echo ""
    log_warn "Run 'source $shell_rc' or restart your terminal to use 'speckit' command"
  fi
}

uninstall_speckit() {
  log_step "Uninstalling SpecKit"

  if [[ -d "$SPECKIT_HOME" ]]; then
    rm -rf "$SPECKIT_HOME"
    log_success "Removed $SPECKIT_HOME"
  fi

  # Remove commands (but keep backup)
  local backup_dir="${SPECKIT_COMMANDS}/.speckit-uninstall-backup"
  mkdir -p "$backup_dir"
  mv "${SPECKIT_COMMANDS}/speckit."*.md "$backup_dir/" 2>/dev/null || true
  log_success "Moved commands to $backup_dir"

  log_warn "PATH entry in shell config not removed - edit manually if desired"
  log_success "SpecKit uninstalled"
}

check_status() {
  log_step "SpecKit Installation Status"
  echo ""

  if check_existing; then
    log_success "SpecKit is installed"
    echo "  Version: $(get_installed_version)"
    echo "  Location: $SPECKIT_HOME"
    echo ""

    # Check components
    echo "Components:"
    [[ -x "${SPECKIT_BIN}/speckit" ]] && log_success "  CLI: installed" || log_warn "  CLI: missing"
    [[ -d "${SPECKIT_HOME}/scripts" ]] && log_success "  Scripts: installed" || log_warn "  Scripts: missing"
    [[ -d "${SPECKIT_HOME}/templates" ]] && log_success "  Templates: installed" || log_warn "  Templates: missing"

    # Count commands
    local cmd_count=$(ls "${SPECKIT_COMMANDS}/speckit."*.md 2>/dev/null | wc -l | tr -d ' ')
    log_success "  Commands: $cmd_count installed"

    # Check PATH
    echo ""
    if command -v speckit &>/dev/null; then
      log_success "speckit command available in PATH"
    else
      log_warn "speckit not in PATH - add to shell config"
    fi
  else
    log_warn "SpecKit is not installed"
    echo "  Run: ./install.sh"
  fi
}

main() {
  local action="install"

  # Parse arguments
  while [[ $# -gt 0 ]]; do
    case "$1" in
      --upgrade|-u)
        action="upgrade"
        shift
        ;;
      --uninstall|--remove)
        action="uninstall"
        shift
        ;;
      --check|--status)
        action="check"
        shift
        ;;
      --help|-h)
        echo "Usage: $0 [--upgrade|--uninstall|--check]"
        exit 0
        ;;
      *)
        log_error "Unknown option: $1"
        exit 1
        ;;
    esac
  done

  print_banner

  case "$action" in
    install)
      if check_existing; then
        local installed=$(get_installed_version)
        local available=$(get_repo_version)
        log_warn "SpecKit already installed (version: $installed)"
        echo ""
        read -p "Upgrade to version $available? [y/N] " response
        if [[ "$response" =~ ^[Yy] ]]; then
          check_dependencies || true
          install_speckit true
          setup_path
        else
          log_info "Use --upgrade to upgrade, or --check to see status"
        fi
      else
        check_dependencies || true
        install_speckit false
        setup_path
      fi
      ;;
    upgrade)
      if ! check_existing; then
        log_error "SpecKit not installed. Run without --upgrade to install."
        exit 1
      fi
      check_dependencies || true
      install_speckit true
      setup_path
      ;;
    uninstall)
      if ! check_existing; then
        log_warn "SpecKit not installed"
        exit 0
      fi
      read -p "Are you sure you want to uninstall SpecKit? [y/N] " response
      if [[ "$response" =~ ^[Yy] ]]; then
        uninstall_speckit
      fi
      ;;
    check)
      check_status
      ;;
  esac

  echo ""
  log_success "Done!"
}

main "$@"
