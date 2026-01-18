#!/usr/bin/env bash
#
# json.sh - JSON manipulation helpers using jq
#
# Source this file when you need JSON operations:
#   source "$(dirname "$0")/lib/json.sh"
#
# Requires: jq
#

# Double-source guard
[[ -n "${SPECFLOW_JSON_LOADED:-}" ]] && return 0

# Source common if not already sourced
SCRIPT_DIR_JSON="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
if [[ -z "${SPECFLOW_COMMON_LOADED:-}" ]]; then
  source "${SCRIPT_DIR_JSON}/common.sh"
fi

# Mark as loaded
SPECFLOW_JSON_LOADED=1

# =============================================================================
# JSON File Operations
# =============================================================================

# Read a value from a JSON file
# Usage: json_get <file> <key>
# Example: json_get state.json ".config.roadmap_path"
json_get() {
  local file="$1"
  local key="$2"

  require_jq

  if [[ ! -f "$file" ]]; then
    log_error "File not found: $file"
    return 1
  fi

  jq -r "$key // empty" "$file"
}

# Read a value with default fallback
# Usage: json_get_or <file> <key> <default>
json_get_or() {
  local file="$1"
  local key="$2"
  local default="$3"

  local value
  value=$(json_get "$file" "$key" 2>/dev/null || echo "")

  if [[ -z "$value" ]]; then
    echo "$default"
  else
    echo "$value"
  fi
}

# Set a value in a JSON file
# Usage: json_set <file> <key> <value>
# Example: json_set state.json ".config.roadmap_path" "ROADMAP.md"
json_set() {
  local file="$1"
  local key="$2"
  local value="$3"

  require_jq

  if [[ ! -f "$file" ]]; then
    log_error "File not found: $file"
    return 1
  fi

  local temp_file
  temp_file=$(mktemp)

  # Use --argjson for non-string types, --arg for strings
  local jq_result=false
  if [[ "$value" == "true" ]] || [[ "$value" == "false" ]] || [[ "$value" == "null" ]]; then
    jq_result=$(jq --argjson v "$value" "$key = \$v" "$file" > "$temp_file" && echo true || echo false)
  elif [[ "$value" =~ ^-?[0-9]+$ ]]; then
    jq_result=$(jq --argjson v "$value" "$key = \$v" "$file" > "$temp_file" && echo true || echo false)
  elif [[ "$value" == "["* ]] || [[ "$value" == "{"* ]]; then
    # JSON array or object - use --argjson
    jq_result=$(jq --argjson v "$value" "$key = \$v" "$file" > "$temp_file" && echo true || echo false)
  else
    # String - use --arg for safe quoting
    jq_result=$(jq --arg v "$value" "$key = \$v" "$file" > "$temp_file" && echo true || echo false)
  fi

  if [[ "$jq_result" == "true" ]]; then
    mv "$temp_file" "$file"
    return 0
  else
    rm -f "$temp_file"
    log_error "Failed to update JSON"
    return 1
  fi
}

# Set a string value (always quoted)
# Usage: json_set_string <file> <key> <value>
json_set_string() {
  local file="$1"
  local key="$2"
  local value="$3"

  require_jq

  local temp_file
  temp_file=$(mktemp)

  if jq --arg v "$value" "$key = \$v" "$file" > "$temp_file"; then
    mv "$temp_file" "$file"
    return 0
  else
    rm -f "$temp_file"
    log_error "Failed to update JSON"
    return 1
  fi
}

# Delete a key from a JSON file
# Usage: json_delete <file> <key>
json_delete() {
  local file="$1"
  local key="$2"

  require_jq

  local temp_file
  temp_file=$(mktemp)

  if jq "del($key)" "$file" > "$temp_file"; then
    mv "$temp_file" "$file"
    return 0
  else
    rm -f "$temp_file"
    return 1
  fi
}

# Check if a key exists in a JSON file
# Usage: json_has <file> <key>
json_has() {
  local file="$1"
  local key="$2"

  require_jq

  local result
  result=$(jq -e "$key != null" "$file" 2>/dev/null)
  [[ "$result" == "true" ]]
}

# =============================================================================
# JSON String Operations
# =============================================================================

# Parse JSON from string and get value
# Usage: json_parse <json_string> <key>
json_parse() {
  local json_string="$1"
  local key="$2"

  require_jq

  echo "$json_string" | jq -r "$key // empty"
}

# Create a JSON object from key-value pairs
# Usage: json_object key1 value1 key2 value2 ...
json_object() {
  require_jq

  local args=()
  while [[ $# -gt 1 ]]; do
    local key="$1"
    local value="$2"
    args+=("--arg" "$key" "$value")
    shift 2
  done

  # Build jq expression
  local expr="{"
  local first=1
  for ((i=0; i<${#args[@]}; i+=3)); do
    local key="${args[i+1]}"
    if [[ $first -eq 0 ]]; then
      expr+=", "
    fi
    expr+="\"$key\": \$$key"
    first=0
  done
  expr+="}"

  jq -n "${args[@]}" "$expr"
}

# =============================================================================
# Array Operations
# =============================================================================

# Append to an array in a JSON file
# Usage: json_array_append <file> <array_key> <value>
json_array_append() {
  local file="$1"
  local key="$2"
  local value="$3"

  require_jq

  local temp_file
  temp_file=$(mktemp)

  # Use --argjson for JSON objects/arrays, --arg for strings (safe quoting)
  local jq_result=false
  if [[ "$value" == "{"* ]] || [[ "$value" == "["* ]]; then
    jq_result=$(jq --argjson v "$value" "$key += [\$v]" "$file" > "$temp_file" && echo true || echo false)
  else
    jq_result=$(jq --arg v "$value" "$key += [\$v]" "$file" > "$temp_file" && echo true || echo false)
  fi

  if [[ "$jq_result" == "true" ]]; then
    mv "$temp_file" "$file"
    return 0
  else
    rm -f "$temp_file"
    return 1
  fi
}

# Get array length
# Usage: json_array_length <file> <array_key>
json_array_length() {
  local file="$1"
  local key="$2"

  require_jq
  jq -r "$key | length" "$file"
}

# =============================================================================
# State File Helpers
# =============================================================================

# Get current state file path
state_file_path() {
  get_state_file
}

# Read from state file
# Usage: state_get <key>
state_get() {
  local key="$1"
  local state_file
  state_file="$(get_state_file)"

  if [[ ! -f "$state_file" ]]; then
    return 1
  fi

  json_get "$state_file" "$key"
}

# Write to state file
# Usage: state_set <key> <value>
state_set() {
  local key="$1"
  local value="$2"
  local state_file
  state_file="$(get_state_file)"

  if [[ ! -f "$state_file" ]]; then
    log_error "State file not found: $state_file"
    return 1
  fi

  json_set "$state_file" "$key" "$value"
}

# Write string to state file (ensures proper quoting)
# Usage: state_set_string <key> <value>
state_set_string() {
  local key="$1"
  local value="$2"
  local state_file
  state_file="$(get_state_file)"

  if [[ ! -f "$state_file" ]]; then
    log_error "State file not found: $state_file"
    return 1
  fi

  json_set_string "$state_file" "$key" "$value"
}

# Update last_updated timestamp in state
state_touch() {
  local state_file
  state_file="$(get_state_file)"

  if [[ -f "$state_file" ]]; then
    json_set_string "$state_file" ".last_updated" "$(iso_timestamp)"
  fi
}

# =============================================================================
# Config Helpers
# =============================================================================

# Get config value with fallback to default
# Usage: config_get <key> <default>
# Example: config_get "roadmap_path" "ROADMAP.md"
config_get() {
  local key="$1"
  local default="${2:-}"
  local state_file
  state_file="$(get_state_file)"

  if [[ -f "$state_file" ]]; then
    local value
    value=$(json_get "$state_file" ".config.$key" 2>/dev/null || echo "")
    if [[ -n "$value" ]]; then
      echo "$value"
      return 0
    fi
  fi

  echo "$default"
}

# Get all config as JSON
config_get_all() {
  local state_file
  state_file="$(get_state_file)"

  if [[ -f "$state_file" ]]; then
    json_get "$state_file" ".config"
  else
    echo "{}"
  fi
}

# =============================================================================
# Validation
# =============================================================================

# Validate JSON file syntax
# Usage: json_validate <file>
json_validate() {
  local file="$1"

  require_jq

  if jq empty "$file" 2>/dev/null; then
    return 0
  else
    log_error "Invalid JSON in file: $file"
    return 1
  fi
}

# Pretty print JSON file
# Usage: json_pretty <file>
json_pretty() {
  local file="$1"

  require_jq
  jq '.' "$file"
}
