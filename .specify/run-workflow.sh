#!/bin/bash
cd "/Users/ppatterson/dev/specflow"
$HOME/.local/bin/claude -p --output-format json --resume "dddb61b2-0efd-44ee-90c2-beef92d5673c" --dangerously-skip-permissions --disallowedTools "AskUserQuestion" --json-schema "$(cat /Users/ppatterson/dev/specflow/.specify/schema.json)" < "/Users/ppatterson/dev/specflow/.specify/resume-prompt.txt" > "/Users/ppatterson/dev/specflow/.specify/workflow-output.json" 2>&1
