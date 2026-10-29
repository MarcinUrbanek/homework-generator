# 10x Astro Starter

![](./public/template.png)

A modern, opinionated starter template for building fast, accessible web applications.

## AI Skills Workflow

See the [project skills workflow](context/foundation/skills-workflow.md) for diagrams of all 28 project-local skills, when to use each one, and copy/paste command sequences. For an existing work session, start with `/project-status` in Copilot Chat.

## Tech Stack

- [Astro](https://astro.build/) v7 - Modern web framework with server-first rendering
- [React](https://react.dev/) v19 - UI library for interactive components
- [TypeScript](https://www.typescriptlang.org/) v6 - Type-safe JavaScript
- [Tailwind CSS](https://tailwindcss.com/) v4 - Utility-first CSS framework
- [Supabase](https://supabase.com/) - Authentication and backend-as-a-service
- [Cloudflare Workers](https://workers.cloudflare.com/) - Edge deployment runtime

## Prerequisites

- Node.js v22.14.0 (as specified in `.nvmrc`)
- npm (comes with Node.js)

## Getting Started

1. Clone the repository:

```bash
git clone https://github.com/przeprogramowani/10x-astro-starter.git
cd 10x-astro-starter
```

2. Install dependencies:

```bash
npm install
```

3. Set up Supabase and configure environment variables — see [Supabase Configuration](#supabase-configuration) below.

4. Create a `.dev.vars` file for local Cloudflare dev secrets:

```bash
cp .env.example .dev.vars
```

5. Run the development server:

```bash
npm run dev
```

## Available Scripts

- `npm run dev` - Start development server (Cloudflare workerd runtime)
- `npm run build` - Build for production
- `npm run preview` - Preview production build
- `npm run lint` - Run ESLint with type-checked rules
- `npm run lint:fix` - Auto-fix ESLint issues
- `npm run format` - Run Prettier
- `npm run test` - Run the Vitest suite once
- `npm run smoke` - Smoke test root-page authentication, the retired dashboard route, and protected teacher routes against a running server (`BASE_URL`, defaults to `http://localhost:4321`)

## Project Structure

```md
.
├── src/
│ ├── layouts/ # Astro layouts
│ ├── pages/ # Astro pages
│ │ └── api/ # API endpoints
│ ├── components/ # UI components (Astro & React)
│ └── assets/ # Static assets
├── public/ # Public assets
├── wrangler.jsonc # Cloudflare Workers config
```

## Supabase Configuration

This project uses [Supabase](https://supabase.com/) for authentication. Environment variables are declared via Astro's `astro:env` schema and are treated as **server-only secrets** — they are never exposed to the client.

### First-time setup (local, no cloud project needed)

Requires [Docker](https://www.docker.com/) and ~7 GB RAM.

1. Create your `.env` file:

```bash
cp .env.example .env
```

2. Initialize the local Supabase project (creates a `supabase/` config folder):

```bash
npx supabase init
```

3. Start the local stack (downloads Docker images on first run):

```bash
npx supabase start
```

4. Copy the credentials printed by the CLI into your `.env` and `.dev.vars`:

```
SUPABASE_URL=http://127.0.0.1:54321
SUPABASE_KEY=<anon key from CLI output>
OPENROUTER_API_KEY=<OpenRouter API key>
OPENROUTER_MODEL=<structured-output-capable model identifier>
```

The OpenRouter values are required only when generating exercises. The rest of the app and the production build work without them.

5. To stop the stack when done:

```bash
npx supabase stop
```

The local Studio UI is available at `http://localhost:54323`.

No database tables or migrations are required — this project uses Supabase Auth's built-in `auth.users` table only.

### Using a cloud Supabase project instead

If you prefer to use a hosted Supabase project, add these variables to your `.env` and `.dev.vars` files:

| Variable       | Description                                                |
| -------------- | ---------------------------------------------------------- |
| `SUPABASE_URL` | Project URL from Supabase dashboard → Settings → API       |
| `SUPABASE_KEY` | `anon` public key from Supabase dashboard → Settings → API |

```
SUPABASE_URL=https://<project-ref>.supabase.co
SUPABASE_KEY=<anon-key>
```

### Email confirmation in local development

By default Supabase requires email confirmation before a user can sign in. To skip this during local development:

1. Open the Supabase dashboard for your project
2. Go to **Authentication → Email → Confirm email**
3. Toggle it **off**

Users can then sign in immediately after sign-up without clicking a confirmation link.

### Auth routes

| Route                     | Description                                                                 |
| ------------------------- | --------------------------------------------------------------------------- |
| `/auth/signin`            | Email/password sign-in form                                                 |
| `/auth/signup`            | Email/password sign-up form                                                 |
| `/auth/confirm-email`     | Post-signup "check your inbox" page                                         |
| `/`                       | Protected, role-aware starting panel (redirects anonymous users to sign-in) |
| `/homework`               | Student's current homework list, when the account has a student role        |
| `/homework/:assignmentId` | One student's allocated homework and final result                           |
| `/exercises/request`      | Teacher-only Polish exercise candidate request page                         |

Route protection is handled in `src/middleware.ts`. The homepage `/` is protected by an exact pathname match; it is not a protected prefix and does not make every route beneath `/` protected. Protected route families such as `/exercises`, `/classes`, and `/homework` use prefix matching through `PROTECTED_ROUTES`. An anonymous request to `/` redirects to `/auth/signin` with the complete path and query in `return_to` (for example, `/?source=example`); after sign-in, the user returns to that destination. The former `/dashboard` route is retired and returns 404 for both anonymous and authenticated users.

## Student homework

Student-role accounts can open **Zadania domowe** from the dashboard. Pending assignments appear before submitted assignments. Each detail page is scoped to the signed-in student's allocation and the class membership that is current when the page or API request is made. Teacher tools remain available to teacher-role accounts; dual-role accounts see both student and teacher entry points. Class-join links stay available from the dashboard even before a student joins a class.

Submission is final. The review screen counts every blank answer, including an entirely blank submission, and explains that blanks are graded incorrect. A submission passes when at least half of the assigned exercises are correct. Answers accept natural numbers as digit strings, including correctly space-grouped thousands such as `12 345`; prose, decimals, signs, and malformed grouping are rejected. Unfinished answers are held only in the current page and are lost on navigation or refresh. Once submitted, answers and per-exercise correctness are read-only and the persisted result is restored on reload.

Leaving a class removes access to that class's homework: its list entries are hidden and detail, submission, result reload, and equivalent retry requests are unavailable. The student UI clears displayed answer/result content after an access-denied response. Do not use a teacher account or an assignment identifier as a substitute for current student membership.

### Verifying the student flow

For a live check, start the local Supabase stack with the repository migrations applied and run the app with `SUPABASE_URL` and `SUPABASE_KEY` configured. Use one teacher and two independently enrolled student accounts:

To generate disposable local test accounts and the class, certified exercises, and assignments used by the manual checks, configure `SUPABASE_KEY` and `SUPABASE_SERVICE_ROLE_KEY` in `.dev.vars` or `.env` and run `npm run seed:homework-manual-test`. The command refuses non-local Supabase URLs, inserts fixture-backed immutable evidence, and promotes exercises through the authenticated approval function; it never inserts an exercise directly into the pool. Sign-in details and scenario-specific URLs and answers are printed by the command and recorded in [the manual verification guide](./context/changes/submit-and-score-homework/manual-verification.md).

1. Assign separate two- and five-exercise homework to the students. Confirm each list/detail shows only that student's allocation and that no canonical answer, verifier data, or classmate data appears in rendered HTML or network responses.
2. On separate assignments, test one of two correct, two of five correct, three of five correct, and all blank. Confirm pass, fail, pass, and fail. Try a grouped number, a large integer string, prose, a decimal, a negative number, and malformed grouping.
3. Simulate a lost response and retry without changing the vector; then try a different vector from another tab. Confirm the persisted result remains final and the conflict view loads that saved result.
4. Remove a student's class membership and verify that list, detail, submit, result reload, and equivalent retry are denied. Check anonymous deep-link return after sign-in and student-only, teacher-only, dual-role, and not-yet-enrolled dashboard entry points.
5. Check keyboard-only use, screen-reader status and focus movement, a narrow viewport, empty/unavailable states, and a recoverable network failure.

The implementation's focused UI/role tests are `npm test -- src/components/homework/StudentHomeworkForm.test.tsx src/lib/services/profile-roles.test.ts`. Broader validation commands are `npm test`, `npm run db:test`, `npm run lint`, `npm run build`, and `npm run smoke` against a configured running app and local Supabase. Record observed outcomes in `context/changes/submit-and-score-homework/manual-verification.md`; do not mark a check complete without evidence.

## Deployment

This project deploys to [Cloudflare Workers](https://workers.cloudflare.com/).

1. Build the project:

```bash
npm run build
```

2. Deploy with Wrangler:

```bash
npx wrangler deploy
```

Set `SUPABASE_URL` and `SUPABASE_KEY` as secrets in your Cloudflare dashboard or via `npx wrangler secret put`.

## OpenRouter exercise generation

Exercise candidates are generated server-side. Keep provider values in the gitignored `.dev.vars` file for local Cloudflare development:

```dotenv
SUPABASE_URL=http://127.0.0.1:54321
SUPABASE_KEY=<anon key from Supabase CLI>
OPENROUTER_API_KEY=<OpenRouter API key>
OPENROUTER_MODEL=<model identifier, for example provider/model-name>
```

`OPENROUTER_MODEL` must identify a model endpoint that supports strict structured JSON output. The request requires structured-output parameters, so an incompatible model fails without returning candidates.

Local workflow:

```bash
npx supabase start
npm run dev
```

For a manual live-provider check, sign in with a teacher profile, open `/exercises/request`, select a topic and difficulty, and generate a batch. Confirm that one to five Polish candidates appear, every proposed answer is marked `Niezweryfikowane`, and no key or raw provider response appears in the browser or server logs. A request attempt may take up to 30 seconds, with one retry for eligible failures.

For deployment, provision `OPENROUTER_API_KEY` as a Cloudflare secret and `OPENROUTER_MODEL` as a server-only environment value. Do not add real provider credentials to committed files or CI variables used by the smoke job.

### Generation request admission

Before deploying the API code, apply the `20261014160000_add_exercise_generation_admission.sql` migration. For a local stack, run:

```bash
npx supabase migration up --local
```

Each authenticated teacher can start at most 10 admitted generation requests in a rolling 60-minute window. An admission charges one application request, including a request that times out, fails, or returns a partial batch; there are no refunds. One admitted request can make up to two provider attempts.

Only one unexpired generation reservation is allowed per teacher. It normally releases when the request finishes and expires after 120 seconds if the request cannot release it. An expired reservation can be replaced, but expiry does not stop provider work that was already started, so old and replacement requests may overlap. Admission is fail-closed: a quota or active-reservation denial returns HTTP 429 with `Retry-After` in whole seconds and makes no provider call; an admission-storage failure returns HTTP 503 and also blocks provider work.

Targeted regression checks:

```bash
npm test -- src/components/exercises/RequestExercisesForm.test.tsx src/lib/services/exercise-generation-admission.test.ts src/pages/api/exercises/request.test.ts src/lib/services/openrouter-exercise-generator.test.ts
npx supabase test db --local supabase/tests/database/exercise_generation_admission.sql
```

## Exercise verification and approval

Verification uses the server-side deterministic **ArithmeticAuthority v1**, not a model verifier. For supported Grade 4 arithmetic it validates the structured expression and difficulty bucket, recomputes a natural-number answer, and binds the exact Polish prompt and answer to immutable evidence. Free-form text, edited prompts, unsupported structures/topics/versions, incorrect proposals, and legacy model-only successes cannot become current approval evidence. OpenRouter settings remain necessary for candidate generation only.

For the teacher verification and approval flow, add these values to `.dev.vars` (never commit real values):

```dotenv
SUPABASE_SERVICE_ROLE_KEY=<service_role key from `npx supabase status`>
```

Generation additionally needs `OPENROUTER_API_KEY` and `OPENROUTER_MODEL`; verification does not. Keep all keys server-side, and provision the service-role key only as a Cloudflare secret.

### Authority rollout and rollback

Before release, review counts of legacy ledger and pool rows plus pending/submitted homework references, without exporting student data. Counts are release evidence; this repository does not claim any deployed legacy count.

Use a maintenance window: stop application traffic, back up the database, apply outstanding migrations in repository order—including `20261016120000_enforce_arithmetic_exercise_authority.sql`, `20261016123000_fix_arithmetic_authority_json_validation.sql`, and `20261016140000_protect_uncertified_homework_consumers.sql`—deploy the compatible application, verify current approval and student-read behavior while traffic remains paused, then reopen. Do not run old student/scoring paths against quarantined data. If verification fails, remain in maintenance or disable affected routes. Roll back only to a compatible version that retains legacy quarantine and student-read protections; never restore the former model-only approval path or re-enable uncertified student prompts. Resume traffic only after the complete guard set is verified.

Local migration and fixture commands:

```bash
npx supabase migration up --local
npm run seed:homework-manual-test
```

Release verification commands (run before reopening traffic):

```bash
npm test
npx astro check
npm run lint
npm run build
npm run db:test
```

Database reset and tests (requires Docker):

```bash
npx supabase db reset
npm run db:test
```

Live-check prerequisites: local Supabase running, a teacher profile, and the service-role configuration above. Generate a batch, run `Zweryfikuj zestaw`, select independently recomputed successful candidates, and `Zatwierdź i zapisz`. Record observed outcomes and retained historical-result checks in the change's manual evidence record; do not treat model agreement or legacy results as current proof.

## Smoke test

`scripts/smoke.mjs` is a Node script that walks the auth flow, verifies anonymous root redirects and the authenticated panel HTML, confirms `/dashboard` stays retired, and checks the protected exercise-request boundary over HTTP. Run it against a server with local Supabase and without OpenRouter values so it verifies the typed missing-configuration response without making a paid provider call:

```bash
npm run build && npm run preview
BASE_URL=http://localhost:4321 npm run smoke
```

It needs a reachable Supabase instance (local or cloud) with email confirmation disabled and the repository migrations applied. The smoke signup receives the default teacher profile created by the database trigger. `npm run smoke` checks that anonymous `/` (including a query-string destination) redirects to a reachable sign-in page, sign-in returns exactly to `/`, the teacher panel contains its expected content, `/dashboard` returns 404 before and after sign-in, and sign-out restores root protection.

When the preview loads provider credentials from `.dev.vars`, set `SMOKE_CONFIGURED_PREVIEW=true` and `SMOKE_EXPECT_UNCONFIGURED_PROVIDERS=false` for the smoke run. This skips the missing-provider assertions, so the smoke does not call provider-backed routes. In PowerShell:

```powershell
$env:SMOKE_CONFIGURED_PREVIEW = "true"
$env:SMOKE_EXPECT_UNCONFIGURED_PROVIDERS = "false"
npm run smoke
```

The smoke suite supplements focused unit and integration tests; it does not replace them.

With a local Supabase, `SMOKE_CLASS_CHECKS=true` and `SMOKE_HOMEWORK_CHECKS=true` (plus `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` for fixtures and cleanup) also run the homework checks. These cover assignment boundaries and submission feedback: the teacher review pages and their 404 for another teacher, saving, rejecting (student 403, other teacher 404, unsubmitted 409) and clearing feedback, the student detail and list feedback flag, and that a classmate never sees another student's comment. The homework pool fixtures are certified through `/api/exercises/approve`. Their append-only verification evidence belongs to a stable local account (`smoke-homework-pool-owner@example.test`) that the smoke reuses and does not delete. Approved pool rows and all per-run accounts are deleted at cleanup.

## CI

GitHub Actions runs two jobs on every push and PR to `master`:

- **ci** — lint, `astro check` and build. Configure `SUPABASE_URL` and `SUPABASE_KEY` as repository secrets for the build step.
- **smoke** — starts a local Supabase via the Supabase CLI, builds, serves the production preview on the Cloudflare runtime and runs `npm run smoke` against it. No secrets required.

## License

MIT
