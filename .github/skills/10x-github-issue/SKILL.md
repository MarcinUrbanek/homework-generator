---
name: 10x-github-issue
description: 'Create and synchronize a 10x roadmap slice or foundation with its GitHub issue: create a missing issue when /10x-new starts mapped work, update status and plan progress, and close it when the roadmap item is done. Use after /10x-new, /10x-plan, /10x-implement, /10x-impl-review, or /10x-archive; for "create the issue", "update the issue", "sync GitHub status", or "keep the issue current".'
argument-hint: '<change-id|roadmap-id|issue-number|--all> [--create-missing]'
---

# /10x-github-issue - Sync 10x Work to GitHub

Synchronize local 10x lifecycle state to the GitHub issue for one roadmap item. Local files are authoritative; GitHub is a status mirror. Never mutate `change.md`, `plan.md`, or `roadmap.md` from GitHub data.

## Modes

- `/10x-github-issue <change-id>` - preferred; for example `approve-first-exercise-pool`.
- `/10x-github-issue <roadmap-id>` - accepts `F-01` or `S-02`, case-insensitively.
- `/10x-github-issue <issue-number>` - verifies that the issue maps to a local roadmap item before updating it.
- `/10x-github-issue --all` - reconcile every item in the open milestone. Ask for confirmation before changing more than one issue.
- `/10x-github-issue <change-id> --create-missing` - create the mapped issue if absent, then synchronize it. `/10x-new` uses this mode after creating `change.md`.
- No argument - infer the only active change under `context/changes/`. If zero or multiple active changes exist, list candidates and STOP.

## Preconditions

1. Require a Git repository with an `origin` GitHub remote and `context/foundation/roadmap.md`.
2. Resolve `<owner>/<repo>` from `git remote get-url origin`. Pass `--repo <owner>/<repo>` to every `gh` command; do not rely on ambient repository selection.
3. Run `gh auth status`. If unauthenticated, explain that `gh auth login` is required and STOP. Verify the selected credential can write to `<owner>/<repo>`. If the active account cannot write and a stored account matching `<owner>` exists, use that account's token only for this command via `GH_TOKEN="$(gh auth token --user <owner>)"`; never print the token or change the active account. If no authenticated account can write, report the permission failure and STOP.
4. Read the roadmap item from both `## At a glance` and its `### F-NN:` or `### S-NN:` body. If their Change ID or Status values disagree, report local drift and STOP for that item.
5. If a matching active or archived change folder exists, read `change.md`. If `plan.md` exists, parse only its `## Progress` section.

## Resolve the Issue

Resolve exactly one local roadmap item first, obtaining `<roadmap-id>`, `<change-id>`, `<outcome>`, and `<roadmap-status>`.

Find its issue in this order:

1. Exact title prefix `[<roadmap-id>]` among open and closed issues.
2. Exact body line `- Change ID: \`<change-id>\``.
3. When the argument is an issue number, inspect that issue and require one of those exact mappings.

Use structured output such as:

```bash
gh issue list --repo <owner>/<repo> --state all --limit 500 \
  --json number,title,state,body,url
```

Zero matches: create the issue only when `--create-missing` was explicitly supplied. Otherwise report the expected title prefix and Change ID, suggest `/10x-github-issue <change-id> --create-missing`, and STOP. Multiple matches: list them and STOP. Never choose by fuzzy title similarity.

## Create a Missing Issue

This path requires `--create-missing` and an exact roadmap match. Immediately before creation, rerun the exact title-prefix and Change ID searches to prevent duplicates from concurrent runs. If a match now exists, use it and continue with synchronization.

1. Read the item's **Suggested issue title** from its exact Change ID row in `## Backlog Handoff`. Use `[<roadmap-id>] <suggested-title>` as the issue title. If that row or title is absent, use the item's `### <roadmap-id>: <title>` heading.
2. Build the body from the roadmap item's current fields, preserving their meaning and using `None` for `—`:

```markdown
## Outcome

<outcome, with a leading "(foundation) " removed for readability>

## Roadmap context

- Roadmap ID: `<roadmap-id>`
- Change ID: `<change-id>`
- Type: <Foundation|Vertical slice>
- Status: <derived GitHub body status>
- PRD references: <roadmap PRD refs>
- Prerequisites: <roadmap prerequisites>
- Parallel with: <roadmap parallel-with>
- Blockers: <roadmap blockers>
- Unknowns: <roadmap unknowns, kept concise>

<For foundations only: ## Unlocks and the roadmap Unlocks value>

## Risk

<roadmap risk>

## Source

`context/foundation/roadmap.md`
```

3. Write the body to a temporary file and run `gh issue create --repo <owner>/<repo> --title "<title>" --body-file <file>`. Remove the temporary file afterward.
4. Refetch the created issue and require exactly one matching title prefix and Change ID line. Then continue with the normal progress-comment and open/closed reconciliation steps.

Issue creation is idempotent through exact matching. Never create from a fuzzy title, from `change.md` alone, or for a Change ID absent from the roadmap.

## Derive Current Status

Map the authoritative roadmap status to the issue body's `Roadmap context` status:

| Roadmap | GitHub body |
| --- | --- |
| `proposed` | `Proposed` |
| `ready` | `Ready` |
| `blocked` | `Blocked` |
| `planning` | `Planning` |
| `in-progress` | `In progress` |
| `done` | `Done` |

The roadmap status wins over `change.md`. Use `change.md` and plan Progress only for the progress comment. Surface, but do not repair, inconsistencies such as roadmap `proposed` with change status `implementing`.

Plan progress is `<done>/<total>` from checkbox rows under `## Progress`. The current step is the first unchecked row; if every row is checked, use `all plan steps complete`. Preserve any existing SHA suffixes when quoting completed steps.

## Preview

Before writing, show:

```text
GitHub issue #<number>: <title>
  Roadmap: <roadmap-id> / <change-id>
  Status:  <old> -> <new>
  Progress: <done>/<total>; <current-step>
  Action:  update body | add progress comment | close | no change
```

For a single issue, proceed without prompting unless the mapping is ambiguous or the operation would reopen a closed issue. For `--all`, ask once for confirmation after showing the complete preview.

## Synchronize

Perform only the actions whose source data changed.

### 1. Update the body status

Fetch the current body immediately before editing. In the `## Roadmap context` section, replace only the exact `- Status: ...` line with the derived value. Preserve every other byte of human-written content as far as the API permits.

If the section or status line is missing, append this minimal block instead of restructuring the body:

```markdown
## Roadmap context

- Roadmap ID: `<roadmap-id>`
- Change ID: `<change-id>`
- Status: <status>
- Source: `context/foundation/roadmap.md`
```

Write through a temporary file and `gh issue edit --body-file`; remove the temporary file afterward. Do not put a multiline body directly in shell arguments.

### 2. Add a meaningful progress comment

Comment when one of these transitions is observed:

- a mapped change folder is created and the slice is selected for work;
- planning started;
- implementation started;
- plan completion count increased;
- implementation review completed;
- slice archived/done.

Use this concise shape, omitting unavailable fields:

```markdown
### 10x status update - <YYYY-MM-DD>

- Status: **<status>**
- Plan progress: **<done>/<total>**
- Current: <current-step>
- Change: `<change-id>`

<!-- 10x-github-issue:<change-id>:<roadmap-status>:<done>/<total>:<change-status> -->
```

Before commenting, inspect existing comments for that exact marker. If present, skip the comment. Do not comment for a body-only correction with no lifecycle or progress transition.

### 3. Reconcile open/closed state

- Roadmap `done` -> close an open issue with reason `completed` after body/comment sync.
- Any status other than `done` -> keep an open issue open.
- A closed issue whose roadmap item is not `done` is a conflict. Report it and STOP; never reopen automatically.

Use `gh issue close <number> --repo <owner>/<repo> --reason completed`. Do not close an issue merely because `change.md` says `implemented` or `impl_reviewed`; `/10x-archive` owns the roadmap transition to `done`.

## Verification

Refetch each changed issue and verify all applicable facts:

- exactly one `- Status: <derived>` line exists in `## Roadmap context`;
- the issue is closed iff the roadmap status is `done`;
- a newly posted marker appears exactly once.

Print the issue URL and a compact action summary. A verification mismatch is an error; report expected versus actual and do not claim success.

## Lifecycle Placement

- After `/10x-new`: invoke `<change-id> --create-missing` when the new Change ID maps to a roadmap item. Create the issue immediately if absent, then add the selected-for-work comment while preserving the roadmap-derived body status.
- After `/10x-plan`: roadmap `planning` becomes GitHub `Planning`.
- During `/10x-implement`: roadmap `in-progress` becomes `In progress`, and completed plan counts may add comments.
- After `/10x-impl-review`: add a review-complete progress comment; keep the issue open.
- After `/10x-archive`: roadmap `done` becomes `Done`, add the final comment, and close the issue.

These lifecycle skills must run this synchronization procedure after their local state transition: `/10x-new`, `/10x-plan`, `/10x-implement`, `/10x-impl-review`, and `/10x-archive`. A sync failure never rolls back valid local work or blocks its commit; report `GitHub sync: failed - <reason>` in that skill's final output. Direct invocation remains available for reconciliation and `--all` repair.

## Safety Rules

- Never use issue title similarity as proof of identity.
- Never overwrite the whole issue from a roadmap template.
- Create only when `--create-missing` is explicit and the Change ID maps exactly to one roadmap item. Never delete, relabel, assign, reopen, or move a project item unless the user asks for that behavior separately.
- Never regress status. Status order is `proposed < ready < planning < in-progress < done`; `blocked` is orthogonal and may replace `proposed` or `ready`, but never `planning`, `in-progress`, or `done` automatically.
- Make repeated invocations idempotent: unchanged local state produces no edit and no comment.