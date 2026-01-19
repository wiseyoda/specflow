#!/bin/bash
cd "/Users/ppatterson/dev/specflow"
$HOME/.local/bin/claude -p --output-format json --resume "1ce0e783-2528-4b98-9ce7-f220c4c9bab0" --dangerously-skip-permissions --disallowedTools "AskUserQuestion" --json-schema "$(cat /Users/ppatterson/dev/specflow/.specify/schema.json)" < "/Users/ppatterson/dev/specflow/.specify/resume-prompt.txt" > "/Users/ppatterson/dev/specflow/.specify/workflow-output.json" 2>&1
