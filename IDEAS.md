# Ideas for the future (user generated)

## Captured on 2026-01-18

[ ] ID-001: Would like the dashboard to be mobile friendly so I can use it on my phone. I'm already running tailscale on both my computer and phone, so I can access the dashboard from my phone. This would enable me to use specflow on the go.

[ ] ID-002: Need a way to turn ideas into new features (both via a claude command and via the dashboard). Just like this document, I have ideas, but there is no real mechanism to turn them into features at the moment. We had that in previous versions of specflow, but it's not there in this version. Ideally, it captures the idea, figures out if it should be 1) added to a current roadmap item that exists, 2) turned into a new roadmap item, [3) captured as a backlog item], [4. fixed immediately (if it's a bug)]. This would turn product management into a feature of specflow itself.

[ ] ID-003: Currently we don't have automatic way to insert backlog items into current implementation / roadmap. When we are working on similar files, it would be nice to grab a backlog items and knock it out. This would require knowledge of what backlog items are relevant to the current files we are working on.

[ ] ID-004: (BUG) Current ui-design.md is being asked for AFTER the tasks complete (was generated after the tasks were completed in one instance.) We need to investigate that ensure we are including it in the design phase (not just the verify phase). Also, there seem to be a lot of false positives on the ui-design based on the words it is looking for, we should make this smarter. I trust claude to know during the design phase if we need to create a ui-design.md or not. 1050 did create the ui-design.md in the design phase, so that's good. 1048 didn't need it but got caught in a verification loop around needing it.

[ ] ID-005: Not even sure if this is possible, but most of my projects have dev servers that are associated with them. Since I'm running locally, it would be kind of nice to handle running the dev server from the dashboard (in the background with the ability to kill). Would need to handle port conflicts well. But if we had that, we could send it into the cli commands as context that "Dev server currently live at: http://localhost:3000" - which would be helpful for debugging by Claude (and by me).

[ ] ID-006: Would be nice to be able to click in to SDD artifacts and edit them in our dashboard, this could be general memory files (overall for the repo in .specify/memory) or specific to a project (in .specify/projects/<project-name>/memory). This would allow us to keep the SDD artifacts up to date as we go and I could review them. Right now I have to keep an IDE open just so I can read the documents that are being created. BONUS: chat like interfact that let's me suggest edits and then it spawns a claude agent to make those updates.

[ ] ID-007: Github status in the dashboard similar to this: https://github.com/Powerlevel9k/powerlevel9k#vcs and also show me the current remote/local branch status (ahead/behind/diverged). etc.

[ ] ID-008: (BUG) During the analyze step, there were issues with project artifacts and it did not auto-fix all of them. It waited for user input (not via the quesiton tool). This killed the end-to-end workflow of orchestrate.

[ ] ID-009: Right now we are using Claude Opus 4.5 for everything, we probably need to be more strategic about when we use which model. Opus is expensive and not always necessary. We should use the right tool for the job. This will dramatically lower costs and probably speed up certain tasks.

[ ] ID-010: (BUG): mark is not handling V-UIX item names.

    DETAILS:

```
 Bash(specflow mark V-027 V-028 V-029)
  ⎿  Marked V-027, V-028, V-029 as complete
     Progress: 58/72 checklist items (81%)
     Section "Error Handling" complete!
     Next: V-001 V-UI1 UI implementation matches ui-design.md mockups

⏺ Bash(specflow mark V-UI1 V-UI2 V-UI3 V-UI4 V-UI5 V-UI6)
  ⎿  Error: Exit code 1
     Error [VALIDATION]: No valid item IDs provided
     Suggestion: Use format: T001, T001..T005, V-001, I-001, C-001, D-001

⏺ Search(pattern: "V-UI", path: "specs/1050-workflow-ui/checklists", output_mode: "content")
  ⎿  Found 6 lines (ctrl+o to expand)

⏺ The V-UI items use a different format. Let me mark them directly in the file and continue with the
  integration items.
```
