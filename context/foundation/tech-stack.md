---
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
---

## Why this stack

This two-week, after-hours web MVP needs authentication, persistent relational data, and a fast path to deployment. The 10x Astro Starter is the recommended TypeScript web starter and provides Astro, React, Supabase authentication and PostgreSQL, typed boundaries, and Cloudflare deployment in one opinionated stack. OpenRouter exercise generation and validation will be added as separate server-side integrations using different models, with API keys kept off the client and long-running calls moved out of request handling if needed. GitHub Actions will run CI and deploy automatically after merges to main.