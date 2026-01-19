#!/bin/bash

# Test script to explore Claude CLI session ID retrieval

echo "=== Test 1: Get context of most recent session ==="
cd /Users/ppatterson/dev/test-app
claude --context --output-format json 2>/dev/null | jq .

echo ""
echo "=== Test 2: Check if there's a way to get active session ==="
# Check what's in the sessions-index.json
echo "Most recent sessions in index:"
cat ~/.claude/projects/-Users-ppatterson-dev-test-app/sessions-index.json | jq '.entries | sort_by(.fileMtime) | reverse | .[0:2] | .[] | {sessionId, created, modified, messageCount}'

echo ""
echo "=== Test 3: Run a quick command and capture session ID ==="
# This captures sessionId from output AFTER completion
result=$(claude -p "Say 'test' only" --output-format json 2>/dev/null)
echo "Full result:"
echo "$result" | jq .
session_id=$(echo "$result" | jq -r '.session_id // .sessionId')
echo "Captured session_id: $session_id"
