#!/usr/bin/env bash
#
# SpecFlow Installation Script
#
# Usage:
#   curl -fsSL https://raw.githubusercontent.com/USER/claude-specflow-orchestration/main/install.sh | bash
#   or
#   ./install.sh
#
# Options:
#   --upgrade     Upgrade existing installation
#   --uninstall   Remove SpecFlow
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
SPECFLOW_HOME="${HOME}/.claude/specflow-system"
SPECFLOW_BIN="${SPECFLOW_HOME}/bin"
SPECFLOW_COMMANDS="${HOME}/.claude/commands"
SPECFLOW_AGENTS="${HOME}/.claude/agents"
REPO_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

log_info() { echo -e "${BLUE}INFO${RESET}: $*"; }
log_success() { echo -e "${GREEN}OK${RESET}: $*"; }
log_warn() { echo -e "${YELLOW}WARN${RESET}: $*"; }
log_error() { echo -e "${RED}ERROR${RESET}: $*" >&2; }
log_step() { echo -e "${BLUE}==>${RESET} ${BOLD}$*${RESET}"; }

print_banner() {
  echo ""
  echo -e "${BOLD}╔════════════════════════════════════════════════╗${RESET}"
  echo -e "${BOLD}║              SpecFlow Installer                 ║${RESET}"
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
  if [[ -d "$SPECFLOW_HOME" ]]; then
    return 0  # Exists
  else
    return 1  # Doesn't exist
  fi
}

get_installed_version() {
  if [[ -f "${SPECFLOW_HOME}/VERSION" ]]; then
    cat "${SPECFLOW_HOME}/VERSION"
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

install_specflow() {
  local upgrade="${1:-false}"

  if [[ "$upgrade" == "true" ]]; then
    log_step "Upgrading SpecFlow"
  else
    log_step "Installing SpecFlow"
  fi

  # Create directories
  mkdir -p "$SPECFLOW_HOME"/{bin,templates,packages}
  mkdir -p "$SPECFLOW_COMMANDS"

  # Copy CLI dispatcher
  log_info "Installing CLI..."
  cp "${REPO_DIR}/bin/specflow" "${SPECFLOW_BIN}/specflow"
  chmod +x "${SPECFLOW_BIN}/specflow"

  # Copy templates to both locations
  log_info "Installing templates..."
  cp "${REPO_DIR}/templates/"* "${SPECFLOW_HOME}/templates/" 2>/dev/null || true
  # Also install to ~/.specflow/templates for CLI access
  mkdir -p "${HOME}/.specflow/templates"
  cp "${REPO_DIR}/templates/"* "${HOME}/.specflow/templates/" 2>/dev/null || true

  # Copy packages (dashboard and shared) - exclude node_modules
  if [[ -d "${REPO_DIR}/packages" ]]; then
    log_info "Installing packages (dashboard, shared, cli)..."
    rm -rf "${SPECFLOW_HOME}/packages"
    mkdir -p "${SPECFLOW_HOME}/packages"
    # Use rsync to exclude node_modules and .next
    if command -v rsync &>/dev/null; then
      rsync -a --exclude='node_modules' --exclude='.next' "${REPO_DIR}/packages/" "${SPECFLOW_HOME}/packages/"
    else
      # Fallback: copy then remove node_modules
      cp -R "${REPO_DIR}/packages" "${SPECFLOW_HOME}/"
      find "${SPECFLOW_HOME}/packages" -name "node_modules" -type d -exec rm -rf {} + 2>/dev/null || true
      find "${SPECFLOW_HOME}/packages" -name ".next" -type d -exec rm -rf {} + 2>/dev/null || true
    fi
    # Copy workspace files for pnpm
    if [[ -f "${REPO_DIR}/pnpm-workspace.yaml" ]]; then
      cp "${REPO_DIR}/pnpm-workspace.yaml" "${SPECFLOW_HOME}/"
    fi
    if [[ -f "${REPO_DIR}/package.json" ]]; then
      cp "${REPO_DIR}/package.json" "${SPECFLOW_HOME}/"
    fi

    # Install CLI dependencies
    log_info "Installing CLI dependencies..."
    if command -v pnpm &>/dev/null; then
      (cd "${SPECFLOW_HOME}" && pnpm install --prod --filter @specflow/cli --filter @specflow/shared 2>/dev/null) || {
        log_warn "pnpm install failed, trying npm..."
        (cd "${SPECFLOW_HOME}/packages/cli" && npm install --omit=dev 2>/dev/null) || log_warn "Could not install CLI dependencies"
      }
    elif command -v npm &>/dev/null; then
      (cd "${SPECFLOW_HOME}/packages/cli" && npm install --omit=dev 2>/dev/null) || log_warn "Could not install CLI dependencies"
    else
      log_warn "Neither pnpm nor npm found - CLI may not work"
    fi
  fi

  # Copy commands (with backup if upgrading)
  log_info "Installing commands..."
  if [[ "$upgrade" == "true" ]]; then
    # Backup existing commands to ~/.specflow/backups/ (NOT ~/.claude/ to avoid import)
    local backup_dir="${HOME}/.specflow/backups/commands-$(date +%Y%m%d%H%M%S)"
    mkdir -p "$backup_dir"
    cp "${SPECFLOW_COMMANDS}/flow."*.md "$backup_dir/" 2>/dev/null || true
    cp "${SPECFLOW_COMMANDS}/specflow."*.md "$backup_dir/" 2>/dev/null || true
    log_info "Backed up existing commands to $backup_dir"

    # Clean up old backups that were incorrectly placed in ~/.claude/commands/
    local old_backup_count=0
    for old_backup in "${SPECFLOW_COMMANDS}/.backup-"*; do
      if [[ -d "$old_backup" ]]; then
        rm -rf "$old_backup"
        ((old_backup_count++)) || true
      fi
    done
    if [[ $old_backup_count -gt 0 ]]; then
      log_info "Cleaned up $old_backup_count old backup director(y|ies) from ~/.claude/commands/"
    fi
  fi

  # Build list of valid command files from source (flow.*.md naming)
  local valid_commands=()
  for cmd in "${REPO_DIR}/commands/"flow.*.md "${REPO_DIR}/commands/utilities/"flow.*.md; do
    if [[ -f "$cmd" ]]; then
      valid_commands+=("$(basename "$cmd")")
    fi
  done

  # Copy commands from main commands directory
  for cmd in "${REPO_DIR}/commands/"flow.*.md; do
    if [[ -f "$cmd" ]]; then
      local filename=$(basename "$cmd")
      cp "$cmd" "${SPECFLOW_COMMANDS}/${filename}"
    fi
  done

  # Copy utility commands
  for cmd in "${REPO_DIR}/commands/utilities/"flow.*.md; do
    if [[ -f "$cmd" ]]; then
      local filename=$(basename "$cmd")
      cp "$cmd" "${SPECFLOW_COMMANDS}/${filename}"
    fi
  done

  # Clean up stale commands (old specflow.*.md and old flow.*.md not in source)
  if [[ "$upgrade" == "true" ]]; then
    local stale_count=0
    # Remove old specflow.*.md commands
    for installed in "${SPECFLOW_COMMANDS}/"specflow.*.md; do
      if [[ -f "$installed" ]]; then
        rm -f "$installed"
        ((stale_count++)) || true
      fi
    done
    # Remove stale flow.*.md commands
    for installed in "${SPECFLOW_COMMANDS}/"flow.*.md; do
      if [[ -f "$installed" ]]; then
        local filename=$(basename "$installed")
        local is_valid=false
        for valid in "${valid_commands[@]}"; do
          if [[ "$filename" == "$valid" ]]; then
            is_valid=true
            break
          fi
        done
        if [[ "$is_valid" == "false" ]]; then
          rm -f "$installed"
          ((stale_count++)) || true
        fi
      fi
    done
    if [[ $stale_count -gt 0 ]]; then
      log_info "Removed $stale_count stale command(s)"
    fi
  fi

  # Copy project-scoped agents (with backup if upgrading)
  if [[ -d "${REPO_DIR}/.claude/agents" ]]; then
    log_info "Installing agents..."
    mkdir -p "${SPECFLOW_AGENTS}"

    if [[ "$upgrade" == "true" ]]; then
      local backup_agents_dir="${HOME}/.specflow/backups/agents-$(date +%Y%m%d%H%M%S)"
      mkdir -p "$backup_agents_dir"
      cp "${SPECFLOW_AGENTS}/specflow-"*.md "$backup_agents_dir/" 2>/dev/null || true
      log_info "Backed up existing agents to $backup_agents_dir"
    fi

    # Build list of valid agent files from source (specflow-*.md naming)
    local valid_agents=()
    for agent in "${REPO_DIR}/.claude/agents/"specflow-*.md; do
      if [[ -f "$agent" ]]; then
        valid_agents+=("$(basename "$agent")")
      fi
    done

    # Copy agent files from source
    for agent in "${REPO_DIR}/.claude/agents/"specflow-*.md; do
      if [[ -f "$agent" ]]; then
        local filename=$(basename "$agent")
        cp "$agent" "${SPECFLOW_AGENTS}/${filename}"
      fi
    done

    # Clean up stale SpecFlow agents
    if [[ "$upgrade" == "true" ]]; then
      local stale_agent_count=0
      for installed in "${SPECFLOW_AGENTS}/"specflow-*.md; do
        if [[ -f "$installed" ]]; then
          local filename=$(basename "$installed")
          local is_valid=false
          for valid in "${valid_agents[@]}"; do
            if [[ "$filename" == "$valid" ]]; then
              is_valid=true
              break
            fi
          done
          if [[ "$is_valid" == "false" ]]; then
            rm -f "$installed"
            ((stale_agent_count++)) || true
          fi
        fi
      done
      if [[ $stale_agent_count -gt 0 ]]; then
        log_info "Removed $stale_agent_count stale agent file(s)"
      fi
    fi
  fi

  # Copy QUESTION_CATEGORIES
  if [[ -f "${REPO_DIR}/QUESTION_CATEGORIES.md" ]]; then
    cp "${REPO_DIR}/QUESTION_CATEGORIES.md" "${SPECFLOW_HOME}/"
  fi

  # Write version file
  get_repo_version > "${SPECFLOW_HOME}/VERSION"

  log_success "SpecFlow installed to ${SPECFLOW_HOME}"
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

  local path_line='export PATH="$HOME/.claude/specflow-system/bin:$PATH"'

  if grep -q "specflow-system/bin" "$shell_rc" 2>/dev/null; then
    log_info "PATH already configured in $shell_rc"
  else
    echo "" >> "$shell_rc"
    echo "# SpecFlow CLI" >> "$shell_rc"
    echo "$path_line" >> "$shell_rc"
    log_success "Added to $shell_rc"
    echo ""
    log_warn "Run 'source $shell_rc' or restart your terminal to use 'specflow' command"
  fi
}

uninstall_specflow() {
  log_step "Uninstalling SpecFlow"

  if [[ -d "$SPECFLOW_HOME" ]]; then
    rm -rf "$SPECFLOW_HOME"
    log_success "Removed $SPECFLOW_HOME"
  fi

  # Remove commands (but keep backup)
  local backup_dir="${HOME}/.specflow/backups/uninstall-$(date +%Y%m%d%H%M%S)"
  mkdir -p "$backup_dir"
  mv "${SPECFLOW_COMMANDS}/flow."*.md "$backup_dir/" 2>/dev/null || true
  mv "${SPECFLOW_COMMANDS}/specflow."*.md "$backup_dir/" 2>/dev/null || true
  mv "${SPECFLOW_AGENTS}/specflow-"*.md "$backup_dir/" 2>/dev/null || true
  log_success "Moved commands to $backup_dir"

  log_warn "PATH entry in shell config not removed - edit manually if desired"
  log_success "SpecFlow uninstalled"
}

check_status() {
  log_step "SpecFlow Installation Status"
  echo ""

  if check_existing; then
    log_success "SpecFlow is installed"
    echo "  Version: $(get_installed_version)"
    echo "  Location: $SPECFLOW_HOME"
    echo ""

    # Check components
    echo "Components:"
    [[ -x "${SPECFLOW_BIN}/specflow" ]] && log_success "  CLI: installed" || log_warn "  CLI: missing"
    [[ -d "${SPECFLOW_HOME}/packages/cli/dist" ]] && log_success "  CLI (TypeScript): built" || log_warn "  CLI (TypeScript): not built"
    [[ -d "${SPECFLOW_HOME}/templates" ]] && log_success "  Templates: installed" || log_warn "  Templates: missing"
    [[ -d "${SPECFLOW_HOME}/packages/dashboard" ]] && log_success "  Dashboard: installed" || log_warn "  Dashboard: missing"

    # Count commands
    local cmd_count=$(ls "${SPECFLOW_COMMANDS}/flow."*.md 2>/dev/null | wc -l | tr -d ' ')
    log_success "  Commands: $cmd_count installed"
    local agent_count=$(ls "${SPECFLOW_AGENTS}/specflow-"*.md 2>/dev/null | wc -l | tr -d ' ')
    log_success "  Agents: $agent_count installed"

    # Check PATH
    echo ""
    if command -v specflow &>/dev/null; then
      log_success "specflow command available in PATH"
    else
      log_warn "specflow not in PATH - add to shell config"
    fi
  else
    log_warn "SpecFlow is not installed"
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
        log_warn "SpecFlow already installed (version: $installed)"
        echo ""
        read -p "Upgrade to version $available? [y/N] " response
        if [[ "$response" =~ ^[Yy] ]]; then
          check_dependencies || true
          install_specflow true
          setup_path
        else
          log_info "Use --upgrade to upgrade, or --check to see status"
        fi
      else
        check_dependencies || true
        install_specflow false
        setup_path
      fi
      ;;
    upgrade)
      if ! check_existing; then
        log_error "SpecFlow not installed. Run without --upgrade to install."
        exit 1
      fi
      check_dependencies || true
      install_specflow true
      setup_path
      ;;
    uninstall)
      if ! check_existing; then
        log_warn "SpecFlow not installed"
        exit 0
      fi
      read -p "Are you sure you want to uninstall SpecFlow? [y/N] " response
      if [[ "$response" =~ ^[Yy] ]]; then
        uninstall_specflow
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
