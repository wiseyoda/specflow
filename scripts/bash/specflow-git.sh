#!/usr/bin/env bash
#
# specflow-git.sh - Git operations for SpecFlow workflows
#
# Usage:
#   specflow git branch create <name>    Create and checkout branch
#   specflow git branch checkout <name>  Checkout existing branch
#   specflow git commit <message>        Stage all and commit
#   specflow git merge <branch>          Merge branch to current
#   specflow git push                    Push current branch
#   specflow git sync                    Fetch all, show status
#

set -euo pipefail

# Source libraries
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
source "${SCRIPT_DIR}/lib/common.sh"

# =============================================================================
# Help
# =============================================================================

show_help() {
  cat << 'EOF'
specflow git - Git operations for SpecFlow workflows

USAGE:
    specflow git <command> [options]

COMMANDS:
    branch create <name>    Create and checkout a new branch
                            Fails if uncommitted changes (commit/stash first)

    branch checkout <name>  Checkout an existing branch
                            Fails if uncommitted changes (commit/stash first)

    branch current          Show current branch name

    branch list             List branches with SpecFlow naming convention

    commit <message>        Stage all changes and commit
                            Adds conventional commit prefix if not present

    merge <branch>          Merge specified branch into current branch

    push                    Push current branch to origin
                            Sets upstream if not already set

    sync                    Fetch all remotes and show status

    status                  Show git status (short format)

OPTIONS:
    --json              Output in JSON format
    -h, --help          Show this help

EXAMPLES:
    specflow git branch create 002-flow-engine
    specflow git branch checkout main
    specflow git commit "feat: add flow engine"
    specflow git merge feature-branch
    specflow git push
    specflow git sync
EOF
}

# =============================================================================
# Helpers
# =============================================================================

# Ensure we're in a git repo
ensure_git_repo() {
  if ! is_git_repo; then
    log_error "Not in a git repository"
    exit 1
  fi
}

# Get current branch name
get_current_branch() {
  git rev-parse --abbrev-ref HEAD 2>/dev/null
}

# Check if branch exists locally
branch_exists_local() {
  git show-ref --verify --quiet "refs/heads/$1" 2>/dev/null
}

# Check if branch exists on remote
branch_exists_remote() {
  git ls-remote --heads origin "$1" 2>/dev/null | grep -q "$1"
}

# Check if there are uncommitted changes
has_uncommitted_changes() {
  ! git diff-index --quiet HEAD -- 2>/dev/null
}

# Check if there are untracked files
has_untracked_files() {
  [[ -n "$(git ls-files --others --exclude-standard 2>/dev/null)" ]]
}

# Check if there are staged changes
has_staged_changes() {
  ! git diff-index --quiet --cached HEAD -- 2>/dev/null
}

# Get upstream branch if set
get_upstream_branch() {
  git rev-parse --abbrev-ref --symbolic-full-name @{u} 2>/dev/null || echo ""
}

# =============================================================================
# Branch Commands
# =============================================================================

cmd_branch_create() {
  local name="$1"

  if [[ -z "$name" ]]; then
    log_error "Branch name required"
    echo "Usage: specflow git branch create <name>"
    exit 1
  fi

  ensure_git_repo

  # Check if branch already exists
  if branch_exists_local "$name"; then
    log_error "Branch already exists: $name"
    log_info "Use 'specflow git branch checkout $name' instead"
    exit 1
  fi

  # Fail if uncommitted changes - agent should handle this explicitly
  if has_uncommitted_changes; then
    log_error "Cannot create branch: uncommitted changes detected"
    log_info "Options:"
    log_info "  1. Commit changes: git add -A && git commit -m 'message'"
    log_info "  2. Stash changes:  git stash push -m 'wip'"
    log_info "  3. Discard changes: git checkout -- . (destructive)"
    exit 1
  fi

  # Create and checkout
  if git checkout -b "$name" 2>/dev/null; then
    log_success "Created and checked out branch: $name"

    if is_json_output; then
      echo "{\"branch\": \"$name\", \"action\": \"created\"}"
    fi
  else
    log_error "Failed to create branch: $name"
    exit 1
  fi
}

cmd_branch_checkout() {
  local name="$1"

  if [[ -z "$name" ]]; then
    log_error "Branch name required"
    echo "Usage: specflow git branch checkout <name>"
    exit 1
  fi

  ensure_git_repo

  # Fail if uncommitted changes - agent should handle this explicitly
  if has_uncommitted_changes; then
    log_error "Cannot switch branch: uncommitted changes detected"
    log_info "Options:"
    log_info "  1. Commit changes: git add -A && git commit -m 'message'"
    log_info "  2. Stash changes:  git stash push -m 'wip'"
    log_info "  3. Discard changes: git checkout -- . (destructive)"
    exit 1
  fi

  # Try local first, then remote
  if branch_exists_local "$name"; then
    git checkout "$name"
    log_success "Checked out branch: $name"
  elif branch_exists_remote "$name"; then
    git checkout -b "$name" "origin/$name"
    log_success "Checked out remote branch: $name"
  else
    log_error "Branch not found: $name"
    log_info "Use 'specflow git branch create $name' to create it"
    exit 1
  fi

  if is_json_output; then
    echo "{\"branch\": \"$name\", \"action\": \"checkout\"}"
  fi
}

cmd_branch_current() {
  ensure_git_repo
  local branch
  branch="$(get_current_branch)"

  if is_json_output; then
    echo "{\"branch\": \"$branch\"}"
  else
    echo "$branch"
  fi
}

cmd_branch_list() {
  ensure_git_repo

  if is_json_output; then
    local branches
    branches=$(git branch --format='%(refname:short)' | jq -R -s 'split("\n") | map(select(. != ""))')
    local current
    current="$(get_current_branch)"
    echo "{\"current\": \"$current\", \"branches\": $branches}"
  else
    log_step "Local branches"
    git branch -v
    echo ""
    log_step "Remote branches"
    git branch -rv 2>/dev/null || log_info "No remote branches"
  fi
}

# =============================================================================
# Commit Command
# =============================================================================

cmd_commit() {
  local message="$1"

  if [[ -z "$message" ]]; then
    log_error "Commit message required"
    echo "Usage: specflow git commit <message>"
    exit 1
  fi

  ensure_git_repo

  # Check if there's anything to commit
  if ! has_uncommitted_changes && ! has_untracked_files && ! has_staged_changes; then
    log_warn "Nothing to commit"
    exit 0
  fi

  # Stage all changes
  git add -A

  # Commit
  if git commit -m "$message"; then
    local sha
    sha=$(git rev-parse --short HEAD)
    log_success "Committed: $sha"

    if is_json_output; then
      echo "{\"sha\": \"$sha\", \"message\": \"$message\"}"
    fi
  else
    log_error "Commit failed"
    exit 1
  fi
}

# =============================================================================
# Merge Command
# =============================================================================

cmd_merge() {
  local branch="$1"

  if [[ -z "$branch" ]]; then
    log_error "Branch name required"
    echo "Usage: specflow git merge <branch>"
    exit 1
  fi

  ensure_git_repo

  local current
  current="$(get_current_branch)"

  # Check if branch exists
  if ! branch_exists_local "$branch" && ! branch_exists_remote "$branch"; then
    log_error "Branch not found: $branch"
    exit 1
  fi

  # Check for uncommitted changes
  if has_uncommitted_changes; then
    log_error "You have uncommitted changes. Commit or stash them first."
    exit 1
  fi

  log_step "Merging $branch into $current"

  if git merge "$branch" --no-edit; then
    log_success "Merged $branch into $current"

    if is_json_output; then
      local sha
      sha=$(git rev-parse --short HEAD)
      echo "{\"merged\": \"$branch\", \"into\": \"$current\", \"sha\": \"$sha\"}"
    fi
  else
    log_error "Merge failed - resolve conflicts and commit"
    exit 1
  fi
}

# =============================================================================
# Push Command
# =============================================================================

cmd_push() {
  ensure_git_repo

  local branch
  branch="$(get_current_branch)"
  local upstream
  upstream="$(get_upstream_branch)"

  # Set upstream if not already set
  if [[ -z "$upstream" ]]; then
    log_info "Setting upstream to origin/$branch"
    if git push -u origin "$branch"; then
      log_success "Pushed $branch (upstream set)"
    else
      log_error "Push failed"
      exit 1
    fi
  else
    if git push; then
      log_success "Pushed $branch"
    else
      log_error "Push failed"
      exit 1
    fi
  fi

  if is_json_output; then
    echo "{\"branch\": \"$branch\", \"pushed\": true}"
  fi
}

# =============================================================================
# Sync Command
# =============================================================================

cmd_sync() {
  ensure_git_repo

  log_step "Fetching all remotes"
  git fetch --all --prune

  log_step "Current status"

  local branch
  branch="$(get_current_branch)"
  local upstream
  upstream="$(get_upstream_branch)"

  echo ""
  echo "  Branch: $branch"

  if [[ -n "$upstream" ]]; then
    local ahead behind
    ahead=$(git rev-list --count "$upstream..HEAD" 2>/dev/null || echo "0")
    behind=$(git rev-list --count "HEAD..$upstream" 2>/dev/null || echo "0")

    echo "  Upstream: $upstream"
    echo "  Ahead: $ahead, Behind: $behind"

    if [[ "$behind" -gt 0 ]]; then
      log_warn "Your branch is behind upstream by $behind commit(s)"
      log_info "Run 'git pull' to update"
    fi
  else
    echo "  Upstream: (not set)"
  fi

  echo ""

  # Show working tree status
  if has_uncommitted_changes || has_untracked_files; then
    log_step "Working tree changes"
    git status -s
  else
    print_status ok "Working tree clean"
  fi

  if is_json_output; then
    local ahead="${ahead:-0}"
    local behind="${behind:-0}"
    echo "{\"branch\": \"$branch\", \"upstream\": \"${upstream:-null}\", \"ahead\": $ahead, \"behind\": $behind}"
  fi
}

# =============================================================================
# Status Command
# =============================================================================

cmd_status() {
  ensure_git_repo

  if is_json_output; then
    local branch
    branch="$(get_current_branch)"
    local changes
    changes=$(git status --porcelain | wc -l | tr -d ' ')
    local staged
    staged=$(git diff --cached --name-only | wc -l | tr -d ' ')
    echo "{\"branch\": \"$branch\", \"changes\": $changes, \"staged\": $staged}"
  else
    git status -sb
  fi
}

# =============================================================================
# Main
# =============================================================================

main() {
  parse_common_flags "$@"
  set -- "${REMAINING_ARGS[@]:-}"

  if [[ $# -eq 0 ]]; then
    show_help
    exit 0
  fi

  local command="$1"
  shift

  case "$command" in
    branch)
      if [[ $# -eq 0 ]]; then
        cmd_branch_list
        exit 0
      fi
      local subcommand="$1"
      shift
      case "$subcommand" in
        create)
          cmd_branch_create "${1:-}"
          ;;
        checkout|co)
          cmd_branch_checkout "${1:-}"
          ;;
        current)
          cmd_branch_current
          ;;
        list|ls)
          cmd_branch_list
          ;;
        *)
          log_error "Unknown branch command: $subcommand"
          echo "Run 'specflow git --help' for usage"
          exit 1
          ;;
      esac
      ;;
    commit)
      cmd_commit "${1:-}"
      ;;
    merge)
      cmd_merge "${1:-}"
      ;;
    push)
      cmd_push
      ;;
    sync)
      cmd_sync
      ;;
    status|st)
      cmd_status
      ;;
    help|--help|-h)
      show_help
      exit 0
      ;;
    *)
      log_error "Unknown command: $command"
      echo "Run 'specflow git --help' for usage"
      exit 1
      ;;
  esac
}

main "$@"
