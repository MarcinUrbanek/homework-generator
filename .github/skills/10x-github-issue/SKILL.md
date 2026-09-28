---
name: 10x-github-issue
description: 'Create and synchronize a 10x change with its GitHub issue: preserve roadmap IDs for mapped work, allocate CH-NN IDs for standalone changes, update status and plan progress, and close completed work. Use after /10x-new, /10x-plan, /10x-implement, /10x-impl-review, or /10x-archive; for "create the issue", "update the issue", "sync GitHub status", or "keep the issue current".'
argument-hint: '<change-id|roadmap-id|issue-number|--all> [--create-missing]'
---

# /10x-github-issue - Sync 10x Work to GitHub

Synchronize local 10x lifecycle state to a GitHub issue. Roadmap-backed work keeps its `F-NN` or `S-NN` identity; a change absent from the roadmap receives the next repository-wide `CH-NN` identity on GitHub. Local files are authoritative; GitHub is a status mirror. Never mutate `change.md`, `plan.md`, or `roadmap.md` from GitHub data.

## Modes

- `/10x-github-issue <change-id>` - preferred; for example `approve-first-exercise-pool`.
- `/10x-github-issue <roadmap-id>` - accepts `F-01` or `S-02`, case-insensitively; `CH-NN` is accepted only when an existing issue maps it to a local standalone change.
- `/10x-github-issue <issue-number>` - verifies that the issue maps to a local roadmap item or change folder before updating it.
- `/10x-github-issue --all` - reconcile every item in the open milestone and every active standalone change. Ask for confirmation before changing more than one issue.
- `/10x-github-issue <change-id> --create-missing` - create the issue if absent, then synchronize it. Roadmap-backed work keeps its roadmap ID; standalone work receives the next `CH-NN`.
- No argument - infer the only active change under `context/changes/`. If zero or multiple active changes exist, list candidates and STOP.

## Preconditions

1. Require a Git repository with an `origin` GitHub remote. Require `context/foundation/roadmap.md` only when resolving a roadmap ID or mapped item; standalone changes remain valid when the roadmap is absent.
2. Resolve `<owner>/<repo>` from `git remote get-url origin`. Pass `--repo <owner>/<repo>` to every `gh` command; do not rely on ambient repository selection.
3. Run `gh auth status`. If unauthenticated, explain that `gh auth login` is required and STOP. Verify the selected credential can write to `<owner>/<repo>`. If the active account cannot write and a stored account matching `<owner>` exists, use that account's token only for this command via `GH_TOKEN="$(gh auth token --user <owner>)"`; never print the token or change the active account. If no authenticated account can write, report the permission failure and STOP.
4. For a mapped item, read it from both `## At a glance` and its `### F-NN:` or `### S-NN:` body. If their Change ID or Status values disagree, report local drift and STOP for that item.
5. For a standalone item, require exactly one matching active or archived change folder and read its `change.md`; the folder name and `change_id` must agree. For either item, read `change.md` when present and parse only the `## Progress` section when `plan.md` exists.

## Resolve the Issue

Resolve exactly one local source first:

- **Mapped:** obtain `<roadmap-id>`, `<change-id>`, `<outcome>`, and `<roadmap-status>` from the exact roadmap entry.
- **Standalone:** obtain `<change-id>`, `<title>`, and `<change-status>` from the exact active or archived change folder. Confirm that no roadmap entry has that Change ID. Its tracking ID is the `CH-NN` prefix on an existing issue, or is allocated during creation.

When the argument is an issue number or `CH-NN`, inspect that issue, read its exact `- Change ID: \`<change-id>\`` line, and require that the referenced local source resolves uniquely. Never treat a `CH-NN` title as sufficient without the body mapping.

Find its issue in this order:

1. Exact body line `- Change ID: \`<change-id>\`` among open and closed issues.
2. For mapped work, exact title prefix `[<roadmap-id>]`.
3. For standalone work with a known tracking ID, exact title prefix `[<CH-NN>]`.
4. When the argument is an issue number, inspect that issue and require one of those exact mappings.

Use structured output such as:

```bash
gh issue list --repo <owner>/<repo> --state all --limit 500 \
  --json number,title,state,body,url
```

Zero matches: create the issue only when `--create-missing` was explicitly supplied. Otherwise report the expected roadmap prefix or `next CH-NN`, plus the Change ID, suggest `/10x-github-issue <change-id> --create-missing`, and STOP. Multiple matches by Change ID or tracking prefix: list them and STOP. Never choose by fuzzy title similarity.

## Create a Missing Issue

This path requires `--create-missing` and either an exact roadmap match or an exact local standalone change. Immediately before creation, refetch all issues and rerun the exact title-prefix and Change ID searches to prevent duplicates from concurrent runs. If a Change ID match now exists, use it and continue with synchronization.

1. Choose the tracking ID and title:
  - **Mapped:** read the **Suggested issue title** from the exact Change ID row in `## Backlog Handoff`. Use `[<roadmap-id>] <suggested-title>`; if absent, use the item's `### <roadmap-id>: <title>` heading.
  - **Standalone:** collect every exact issue title prefix matching `^\[CH-(\d+)\]`, set the next number to one greater than the maximum (or `1` when none exist), and zero-pad to at least two digits: `CH-01`, `CH-02`, ..., `CH-100`. Use `[<CH-NN>] <change.md title>`. Refetch and recompute immediately before `gh issue create`; if the candidate prefix or Change ID appeared, resolve the conflict instead of creating a duplicate.
2. Build the body for mapped work from the roadmap item's current fields, preserving their meaning and using `None` for `—`:

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

For standalone work, use:

```markdown
## Outcome

<change.md title>

## Change context

- Tracking ID: `<CH-NN>`
- Change ID: `<change-id>`
- Type: Standalone change
- Status: <derived GitHub body status>

## Source

`context/changes/<change-id>/change.md`
```

3. Write the body to a temporary file and run `gh issue create --repo <owner>/<repo> --title "<title>" --body-file <file>`. Remove the temporary file afterward.
4. Refetch the created issue and require exactly one matching title prefix and Change ID line. Then continue with the normal progress-comment and open/closed reconciliation steps.

Issue creation is idempotent through exact Change ID mapping. Never create from a fuzzy title. A standalone issue may be created from `change.md` only after proving the Change ID is absent from the roadmap and the local folder identity is exact.

## Derive Current Status

For mapped work, map the authoritative roadmap status to the issue body's `Roadmap context` status:

| Roadmap | GitHub body |
| --- | --- |
| `proposed` | `Proposed` |
| `ready` | `Ready` |
| `blocked` | `Blocked` |
| `planning` | `Planning` |
| `in-progress` | `In progress` |
| `done` | `Done` |

The roadmap status wins over `change.md`. Surface, but do not repair, inconsistencies such as roadmap `proposed` with change status `implementing`.

For standalone work, map authoritative `change.md` status to the issue body's `Change context` status:

| Change | GitHub body |
| --- | --- |
| `new` | `New` |
| `preparing` | `Preparing` |
| `planned` | `Planned` |
| `plan_reviewed` | `Plan reviewed` |
| `implementing` | `In progress` |
| `implemented` | `Implemented` |
| `impl_reviewed` | `Reviewed` |
| `archived` | `Done` |
| `blocked` | `Blocked` |

Use plan Progress only for the progress comment. A standalone issue is complete only when `change.md` is `archived`; `implemented` and `impl_reviewed` remain open.

Plan progress is `<done>/<total>` from checkbox rows under `## Progress`. The current step is the first unchecked row; if every row is checked, use `all plan steps complete`. Preserve any existing SHA suffixes when quoting completed steps. When no plan or Progress section exists, omit the human-readable Progress and Current lines and use `na/na` in the idempotency marker.

## Preview

Before writing, show:

```text
GitHub issue #<number>: <title>
  Tracking: <roadmap-id|CH-NN> / <change-id>
  Status:  <old> -> <new>
  Progress: <done>/<total>; <current-step>
  Action:  update body | add progress comment | close | no change
```

For a single issue, proceed without prompting unless the mapping is ambiguous or the operation would reopen a closed issue. For `--all`, ask once for confirmation after showing the complete preview.

## Synchronize

Perform only the actions whose source data changed.

### 1. Update the body status

Fetch the current body immediately before editing. In the mapped issue's `## Roadmap context` or standalone issue's `## Change context`, replace only the exact `- Status: ...` line with the derived value. Preserve every other byte of human-written content as far as the API permits.

If the section or status line is missing, append the appropriate minimal block instead of restructuring the body:

```markdown
## Roadmap context

- Roadmap ID: `<roadmap-id>`
- Change ID: `<change-id>`
- Status: <status>
- Source: `context/foundation/roadmap.md`
```

```markdown
## Change context

- Tracking ID: `<CH-NN>`
- Change ID: `<change-id>`
- Status: <status>
- Source: `context/changes/<change-id>/change.md`
```

Write through a temporary file and `gh issue edit --body-file`; remove the temporary file afterward. Do not put a multiline body directly in shell arguments.

### 2. Add a meaningful progress comment

Comment when one of these transitions is observed:

- a change folder is created and selected for work;
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

<!-- 10x-github-issue:<change-id>:<source-status>:<done>/<total>:<change-status> -->
```

Before commenting, inspect existing comments for that exact marker. If present, skip the comment. Do not comment for a body-only correction with no lifecycle or progress transition.

### 3. Reconcile open/closed state

- Mapped roadmap `done`, or standalone change `archived`, -> close an open issue with reason `completed` after body/comment sync.
- Any other authoritative status -> keep an open issue open.
- A closed issue whose authoritative source is not complete is a conflict. Report it and STOP; never reopen automatically.

Use `gh issue close <number> --repo <owner>/<repo> --reason completed`. Do not close an issue merely because `change.md` says `implemented` or `impl_reviewed`; `/10x-archive` owns completion.

## Verification

Refetch each changed issue and verify all applicable facts:

- exactly one `- Status: <derived>` line exists in the applicable context section;
- the issue is closed iff the roadmap status is `done` or the standalone change status is `archived`;
- a newly posted marker appears exactly once.

Print the issue URL and a compact action summary. A verification mismatch is an error; report expected versus actual and do not claim success.

## Lifecycle Placement

- After `/10x-new`: always invoke `<change-id> --create-missing`. Create the issue immediately if absent, using the roadmap ID when mapped or allocating `CH-NN` when standalone, then add the selected-for-work comment.
- After `/10x-plan`: invoke `<change-id> --create-missing`; mapped roadmap `planning` becomes `Planning`, while standalone `planned` becomes `Planned`.
- During `/10x-implement`: invoke `<change-id> --create-missing`; mapped roadmap `in-progress` and standalone `implementing` become `In progress`, and completed plan counts may add comments.
- After `/10x-impl-review`: invoke `<change-id> --create-missing`, add a review-complete progress comment, and keep the issue open.
- After `/10x-archive`: mapped roadmap `done` or standalone `archived` becomes `Done`; add the final comment and close the issue.

These lifecycle skills must run this synchronization procedure after their local state transition: `/10x-new`, `/10x-plan`, `/10x-implement`, `/10x-impl-review`, and `/10x-archive`. A sync failure never rolls back valid local work or blocks its commit; report `GitHub sync: failed - <reason>` in that skill's final output. Direct invocation remains available for reconciliation and `--all` repair.

## Safety Rules

- Never use issue title similarity as proof of identity.
- Never overwrite the whole issue from a roadmap template.
- Create only when `--create-missing` is explicit and the Change ID resolves exactly to one roadmap item or one local standalone change. Never delete, relabel, assign, reopen, or move a project item unless the user asks for that behavior separately.
- Never reuse or renumber an existing `CH-NN`; gaps remain gaps, and allocation always uses `max(existing CH number) + 1`.
- Never regress status. Mapped order is `proposed < ready < planning < in-progress < done`; standalone order follows the `change.md` lifecycle through `archived`. `blocked` is orthogonal and never automatically replaces an advanced state.
- Make repeated invocations idempotent: unchanged local state produces no edit and no comment.