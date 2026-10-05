---
bootstrapped_at: 2026-09-16T05:56:28Z
starter_id: 10x-astro-starter
starter_name: 10x Astro Starter (Astro + Supabase + Cloudflare)
project_name: homework-generator
language_family: js
package_manager: npm
cwd_strategy: git-clone
bootstrapper_confidence: first-class
phase_3_status: ok
audit_command: npm audit --json
---

## Hand-off

```yaml
starter_id: 10x-astro-starter
package_manager: npm
project_name: homework-generator
hints:
  language_family: js
  team_size: solo
  deployment_target: cloudflare-pages
  ci_provider: github-actions
  ci_default_flow: auto-deploy-on-merge
  bootstrapper_confidence: first-class
  path_taken: standard
  quality_override: false
  self_check_answers: null
  has_auth: true
  has_payments: false
  has_realtime: false
  has_ai: true
  has_background_jobs: false
```

### Why this stack

This two-week, after-hours web MVP needs authentication, persistent relational data, and a fast path to deployment. The 10x Astro Starter is the recommended TypeScript web starter and provides Astro, React, Supabase authentication and PostgreSQL, typed boundaries, and Cloudflare deployment in one opinionated stack. OpenRouter exercise generation and validation will be added as separate server-side integrations using different models, with API keys kept off the client and long-running calls moved out of request handling if needed. GitHub Actions will run CI and deploy automatically after merges to main.

## Pre-scaffold verification

| Signal | Value | Severity | Notes |
| --- | --- | --- | --- |
| npm package | not run | n/a | Starter uses `git clone`; no create-package was derived |
| GitHub repo | `przeprogramowani/10x-astro-starter` last pushed 2026-09-12T21:16:08Z | fresh | From card `docs_url` |

## Scaffold log

**Resolved invocation**: `git clone https://github.com/przeprogramowani/10x-astro-starter .bootstrap-scaffold && cd .bootstrap-scaffold && npm install`
**Strategy**: git-clone
**Exit code**: 0
**Files moved**: 51 tracked starter files
**Conflicts (.scaffold siblings)**: none
**.gitignore handling**: moved silently
**.bootstrap-scaffold cleanup**: deleted
**Validation**: `npm run build` completed successfully
**Warnings**: Node 24.14.0 is below the `^24.16.0` range declared by `astro-eslint-parser` and `eslint-plugin-astro`; Astro also skipped sitemap generation because `site` is not configured.
**Merge recovery**: Windows blocked moving the staged `node_modules` directory, so dependencies were installed directly in the project root and validated before the staging directory was removed.

## Post-scaffold audit

**Tool**: `npm audit --json`
**Summary**: 0 CRITICAL, 0 HIGH, 0 MODERATE, 0 LOW
**Direct vs transitive**: no findings to classify

#### CRITICAL findings

None.

#### HIGH findings

None.

#### MODERATE findings

None.

#### LOW / INFO findings

None.

## Hints recorded but not acted on

| Hint | Value |
| --- | --- |
| bootstrapper_confidence | first-class |
| quality_override | false |
| path_taken | standard |
| self_check_answers | null |
| team_size | solo |
| deployment_target | cloudflare-pages |
| ci_provider | github-actions |
| ci_default_flow | auto-deploy-on-merge |
| has_auth | true |
| has_payments | false |
| has_realtime | false |
| has_ai | true |
| has_background_jobs | false |

## Next steps

Next: a future skill will set up agent context (CLAUDE.md, AGENTS.md). For now, your project is scaffolded and verified - happy hacking.

Useful manual steps in the meantime:
- `git init` (if you have not already) to start your own repo history.
- Review any `.scaffold` siblings the conflict policy created and decide which version of each file to keep.
- Address audit findings per your project's risk tolerance - the full breakdown is in this log.