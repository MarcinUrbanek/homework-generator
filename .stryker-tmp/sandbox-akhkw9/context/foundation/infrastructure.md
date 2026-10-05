---
project: homework-generator
researched_at: 2026-09-21
recommended_platform: Cloudflare Workers
runner_up: Vercel
context_type: mvp
tech_stack:
  language: TypeScript
  framework: Astro 7.3.2 with React 19.2.6
  runtime: Cloudflare Workers (workerd)
---

## Recommendation

**Deploy on Cloudflare Workers.**

The repository already targets Workers with `@astrojs/cloudflare` 14.3.1, Wrangler 4.131.1, a current adapter entrypoint, and `workerd`-based local development. It earned the strongest platform score without requiring an adapter or runtime migration; the stateless request model, balanced cost/DX preference, Poland-focused audience, and acceptance of external Supabase all fit the Workers free tier for early MVP traffic.

Research and feature statuses were checked on 2026-09-21 against official platform and Astro documentation.

## Platform Comparison

Scoring uses Pass = 2, Partial = 1, and Fail = 0. The total covers the five agent-friendly criteria; existing-stack fit and the interview answers break close scores.

| Platform           | CLI-first | Managed/Serverless | Agent-readable docs | Stable deploy API | MCP / Integration | Total |
| ------------------ | --------- | ------------------ | ------------------- | ----------------- | ----------------- | ----: |
| Cloudflare Workers | Pass      | Pass               | Pass                | Pass              | Pass              | 10/10 |
| Vercel             | Pass      | Pass               | Pass                | Pass              | Partial           |  9/10 |
| Netlify            | Partial   | Pass               | Pass                | Pass              | Pass              |  9/10 |
| Railway            | Pass      | Partial            | Pass                | Pass              | Pass              |  9/10 |
| Render             | Partial   | Partial            | Pass                | Pass              | Pass              |  8/10 |
| Fly.io             | Pass      | Partial            | Pass                | Pass              | Fail              |  7/10 |

**Cloudflare Workers.** Wrangler covers deploy, version upload, rollback, secrets, status, and live logs. Cloudflare publishes Markdown documentation and `llms.txt`, and operates official OAuth/API-token MCP servers for API, builds, bindings, and observability. Workers is fully managed and its deploy API is deterministic. At 10k-100k monthly requests, the Free plan's 100,000 requests/day is sufficient if each invocation stays within the 10 ms CPU limit; Paid starts at $5/month and includes 10 million requests and 30 million CPU milliseconds. The current Astro adapter supports Workers only, not Cloudflare Pages.

**Vercel.** Vercel has first-class Astro SSR through `@astrojs/vercel/serverless`, automatic Git previews, strong CLI deploy/log/rollback operations, and agent-oriented documentation. Hobby includes one million function invocations and edge requests per month, enough for the expected traffic. Its official MCP can manage projects, deployments, logs, and analytics, but remains **beta** as of 2026-09-21. Choosing it would require replacing the existing Cloudflare adapter and Wrangler configuration.

**Netlify.** The official Astro adapter supports SSR through Netlify Functions, and Astro 5.12+ can emulate Netlify features through the normal `astro dev` command. Documentation is available as Markdown and through `llms.txt`; the official remote MCP is documented and supported. Netlify's Free plan includes 300 monthly credits, with web requests charged at 2 credits per 10,000 requests, but compute, bandwidth, and production deploys consume the same pool. CLI deployment is strong, while rollback and some observability paths are less consistently CLI-first, producing the Partial score.

**Railway.** Railway offers a strong CLI, official MCP, readable docs, stable deploy flow, and a $5 Hobby plan with $5 of included usage. It supports Astro SSR after migration to `@astrojs/node` standalone mode and an explicit `0.0.0.0` listener. It ranks below the adapter-native serverless choices because it introduces a provisioned Node service, runtime resource billing, and a start-process configuration that this stateless MVP does not need. Railway App Sleep is **beta** as of 2026-09-21 and was not counted as a cost guarantee.

**Render.** Render supports Astro SSR as a Node web service, Git previews, zero-downtime deploys, instant rollback of retained builds, an API/CLI, and an official MCP endpoint. The Hobby workspace is free, with Free compute available for prototypes; a non-sleeping Starter web service is $7/month. It requires the Node adapter and service process, and some rollback/setup operations remain dashboard-oriented, so CLI-first and managed/serverless score Partial.

**Fly.io.** Fly.io's `flyctl`, API, GitHub-hosted docs, WebSocket support, and Warsaw region are strong. A 256 MB shared Machine starts around $1.94/month before regional and network adjustments, with usage-based billing and no standing free production tier. Astro SSR requires replacing the Cloudflare adapter with `@astrojs/node` and generating a Docker image and Machine configuration. That adds operational surface outside this MVP's needs, and no first-party Fly.io MCP server was found as of 2026-09-21.

### Shortlisted Platforms

#### 1. Cloudflare Workers (Recommended)

Workers wins because it is the only candidate already encoded throughout the selected stack. Astro 7's Cloudflare adapter runs development and preview in the real `workerd` runtime, builds the current Wrangler entrypoint, and deploys with one command. It combines the lowest migration risk with a sufficient free tier, encrypted secrets, version previews, immediate code rollback, readable docs, and official MCP integrations.

#### 2. Vercel

Vercel offers the most polished alternative for serverless Astro SSR, especially for automatic pull-request previews and integrated deployment operations. It trails because changing adapters provides little MVP benefit for this repository, and its otherwise strong MCP integration remains beta.

#### 3. Netlify

Netlify is another capable serverless Astro target with good local emulation and an official MCP server. It trails Vercel because its shared-credit pricing is harder to forecast and rollback/logging workflows are less uniformly CLI-first, while still requiring the same adapter migration away from the chosen Workers runtime.

## Anti-Bias Cross-Check: Cloudflare Workers

### Devil's Advocate - Weaknesses

1. `workerd` is not Node.js. The `nodejs_compat` flag covers many APIs, but a future OpenRouter SDK or transitive CommonJS dependency can still fail at build or runtime.
2. The Free plan allows only 10 ms CPU per invocation. AI-response parsing, validation, or substantial server rendering could require the $5 paid plan even at low request volume.
3. External Supabase keeps the architecture split across vendors. Database and auth round trips may dominate latency despite execution at Cloudflare's edge.
4. Preview URLs, Supabase callback URLs, and per-environment secrets need explicit coordination; the workflow is less automatic than Vercel's default PR preview setup.
5. A Worker rollback restores code but does not revert Supabase migrations, changed secrets, or external data, so a nominal rollback can leave incompatible state.

### Pre-Mortem - How This Could Fail

Six months in, the team discovers that choosing Workers optimized deployment before validating the AI workload. The first release was fast and cheap, but exercise generation and validation accumulated Node-oriented dependencies that behaved differently under `workerd`. Local development caught some issues, yet occasional production failures appeared only with real payload sizes and external API latency. The Free plan's CPU ceiling was exceeded, prompting an unplanned move to the paid tier. Meanwhile, every request crossed from a nearby Cloudflare edge to Supabase and OpenRouter; the extra round trips erased much of the edge advantage and made failures harder to trace across three vendors. Preview deployments reused production-oriented Supabase settings because branch-specific callback URLs and secrets were never formalized, so authentication tests were unreliable. Finally, a bad schema migration shipped with an otherwise reversible Worker release. Wrangler restored the previous Worker version in minutes, but the old code no longer matched the database. Recovery required a manual forward migration under pressure. Cloudflare itself remained stable; the failure came from treating code deployment, data changes, secrets, and external-service behavior as one reversible unit when they were not.

### Unknown Unknowns

- Astro 7's Cloudflare adapter runs both `astro dev` and `astro preview` in `workerd`; a separate `wrangler dev` loop is redundant for this pinned stack.
- Cloudflare Pages support was removed from the adapter. This project must deploy to Workers despite the older `cloudflare-pages` hint in `tech-stack.md`.
- The adapter defaults to a Cloudflare Images binding and can auto-provision it; image behavior and billing should be reviewed before adding generated assets.
- Environment selection now happens at build time through `CLOUDFLARE_ENV`; building once and later choosing a Wrangler environment with `--env` is not the canonical Astro 7 workflow.
- Astro can auto-provision a `SESSION` KV namespace unless sessions are disabled. KV is eventually consistent across regions, although this app currently uses Supabase cookie sessions.

## Operational Story

- **Preview deploys**: Cloudflare Workers Builds can connect to GitHub and report build status on pull requests. `npm run build && npx wrangler versions upload --preview-alias <branch-name>` creates a stable branch-style URL at `<alias>-<worker>.<subdomain>.workers.dev`; previews are public by default and should be protected with Cloudflare Access when they expose authenticated test data. Runtime logs are currently unavailable for preview URLs.
- **Secrets**: Production values are encrypted per Worker with `npx wrangler secret put SUPABASE_URL` and `npx wrangler secret put SUPABASE_KEY`; values cannot be read back through Wrangler or the dashboard. Local values live only in gitignored `.dev.vars`. Secret rotation creates and immediately deploys a Worker version, so production rotation requires human approval and a post-rotation auth check.
- **Rollback**: List versions with `npx wrangler versions list --json`, then run `npx wrangler rollback <VERSION_ID> --message "rollback reason"`. Cloudflare immediately creates a deployment that sends 100% of traffic to that version; verify within minutes. Connected resources, Supabase migrations, secrets, and external data do not roll back and must be handled separately.
- **Approval**: An agent may run builds, upload preview versions, inspect deployment status, and tail logs using a project-scoped token. A human approves every production `npx wrangler deploy` or `npx wrangler versions deploy`, secret rotation, database migration, route/domain change, and destructive action such as deleting a Worker or database.
- **Logs**: Use `npx wrangler tail --format json` for read-only live production logs and `npx wrangler deployments status --json` for current deployment state. Persisted Workers Logs retain three days on Free and seven days on Paid; live tailing can be sampled under high volume.

## Risk Register

| Risk                                                                         | Source           | Likelihood | Impact | Mitigation                                                                                                                                               |
| ---------------------------------------------------------------------------- | ---------------- | ---------: | -----: | -------------------------------------------------------------------------------------------------------------------------------------------------------- |
| A dependency relies on unsupported Node.js or CommonJS behavior in `workerd` | Devil's advocate |          M |      H | Keep `nodejs_compat`, run `npm run build` and `npm run preview` for every dependency change, and isolate OpenRouter calls behind a small service module. |
| Free-tier requests exceed the 10 ms CPU limit                                | Devil's advocate |          M |      M | Measure invocation CPU before launch, keep model calls I/O-bound, and budget the $5 Workers Paid plan as the first scaling step.                         |
| Supabase or OpenRouter round trips erase edge latency gains                  | Devil's advocate |          M |      M | Choose an EU Supabase region, measure end-to-end p95 latency from Poland, and minimize sequential server-side calls.                                     |
| Preview auth uses production callbacks, secrets, or data                     | Pre-mortem       |          M |      H | Create explicit preview Supabase URLs/keys and callback allowlists; protect preview URLs with Cloudflare Access.                                         |
| Worker rollback leaves an incompatible database schema                       | Pre-mortem       |          M |      H | Use backward-compatible expand/contract migrations and document a forward-fix procedure before every schema change.                                      |
| A new AI SDK works under Node but fails in Workers                           | Unknown unknowns |          M |      H | Verify each SDK in `workerd` before adoption; prefer standards-based `fetch` integrations when practical.                                                |
| Auto-provisioned Images or Session KV creates unexpected behavior or cost    | Unknown unknowns |          L |      M | Set `imageService` deliberately and disable Astro sessions if unused; review generated bindings before production deploy.                                |
| `CLOUDFLARE_ENV` is omitted and the wrong environment is built               | Unknown unknowns |          M |      H | Use separate explicit build/deploy commands per environment and fail CI when required environment markers or secrets are absent.                         |
| Preview URL incidents cannot be diagnosed with normal Worker logs            | Research finding |          M |      M | Reproduce against a protected staging deployment with logging enabled and keep preview changes small.                                                    |
| Official MCP access grants broader mutation rights than intended             | Research finding |          L |      H | Prefer Wrangler for MVP operations; if MCP is enabled, use a project-scoped token, least permissions, and human confirmation for mutations.              |

## Getting Started

1. Authenticate the pinned local Wrangler CLI with `npx wrangler login`; this is a one-time human browser flow.
2. Add production secrets with `npx wrangler secret put SUPABASE_URL` and `npx wrangler secret put SUPABASE_KEY`. Type values directly into the terminal prompt; keep local equivalents in `.dev.vars`.
3. Run `npm run build` and then `npm run preview`. With Astro 7.3.2 and `@astrojs/cloudflare` 14.3.1, both build-time prerendering and preview use `workerd`; do not add a separate platform-native dev command.
4. Create a reviewable non-production version with `npm run build && npx wrangler versions upload --preview-alias staging`, then verify authentication and protected routes at the returned preview URL.
5. After human approval, publish with `npx wrangler deploy`, verify `npx wrangler deployments status --json`, and watch initial requests with `npx wrangler tail --format json`.

## Out of Scope

The following were not evaluated in this research:

- Docker image configuration
- CI/CD pipeline setup
- Production-scale architecture (multi-region, HA, DR)

## Research Sources

- [Astro Cloudflare adapter](https://docs.astro.build/en/guides/integrations-guide/cloudflare/)
- [Cloudflare Workers pricing](https://developers.cloudflare.com/workers/platform/pricing/)
- [Cloudflare Wrangler commands](https://developers.cloudflare.com/workers/wrangler/commands/workers/)
- [Cloudflare preview URLs](https://developers.cloudflare.com/workers/configuration/previews/)
- [Cloudflare MCP servers](https://developers.cloudflare.com/agents/model-context-protocol/mcp-servers-for-cloudflare/)
- [Vercel Astro support and pricing](https://vercel.com/docs/frameworks/frontend/astro)
- [Vercel MCP - beta](https://vercel.com/docs/mcp/vercel-mcp)
- [Netlify Astro support and pricing](https://docs.netlify.com/build/frameworks/framework-setup-guides/astro/)
- [Netlify MCP](https://docs.netlify.com/welcome/build-with-ai/netlify-mcp-server/)
- [Fly.io Astro support and pricing](https://fly.io/docs/js/frameworks/astro/)
- [Railway Astro support and pricing](https://docs.railway.com/guides/astro)
- [Render Astro support and pricing](https://render.com/docs/deploy-astro)
