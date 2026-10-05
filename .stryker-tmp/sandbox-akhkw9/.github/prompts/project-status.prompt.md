---
name: "Project Status"
description: "Summarize roadmap and change progress, identify the next ready task, and show the commands needed to continue it"
agent: "agent"
---

Report the current status of this project using repository evidence. Do not modify files or synchronize GitHub issues.

Use these sources in this priority order:

1. [Roadmap](../../context/foundation/roadmap.md) for milestone scope, task ordering, prerequisites, blockers, and roadmap statuses.
2. `context/changes/*/change.md` and each active change's `plan.md` `## Progress` section for work in progress.
3. `context/archive/*/change.md` and archived plans to confirm completed changes.
4. Git status only to mention relevant uncommitted work; do not treat it as roadmap progress.

Count roadmap rows by status and report both the completed fraction and percentage. Treat each F-NN or S-NN row as one task/issue. If roadmap detail and the "At a glance" table disagree, call out the discrepancy instead of guessing.

Choose the next task as follows:

- Resume an active change first, using the first unchecked item in its plan's `## Progress` section.
- Otherwise select the earliest non-complete roadmap item whose prerequisites are all `done` and which is not blocked.
- Never recommend a task whose prerequisites are incomplete.
- Mention blocked work separately, including the decision or dependency that blocks it.

For the selected task, provide only commands that apply to its current lifecycle state. Use exact identifiers from the repository. Typical command progression is:

```text
/10x-new <change-id> <brief roadmap outcome>
/10x-plan <change-id>
/10x-plan-review <change-id>
/10x-implement <change-id> phase <N>
/10x-impl-review <change-id>
/10x-archive <change-id>
```

Do not include later commands as immediately runnable when an earlier lifecycle step must happen first. Label chat slash commands as "Copilot Chat commands". Put shell verification commands in a separate optional section only when an active plan explicitly names them.

Return this concise structure:

```markdown
## Project Status
- Milestone: <name and status>
- Progress: <done>/<total> tasks complete (<percentage>%)
- Breakdown: <counts by roadmap status>
- Active change: <change-id and plan progress, or none>

## Completed
- <roadmap ID>: <outcome>

## Next Task
<roadmap ID and change ID, outcome, and one-sentence reason it is next>

## Commands
1. `<next command>` - <what it does>
2. `<following command, only when useful after step 1>` - <what it does>

## Blockers
- <blocked roadmap item and blocker, or none>
```

Keep the answer factual and brief. Include repository-relative file links for the roadmap and selected change artifacts.