# ADR 0001 (frontend): Package manager — evaluate switching from npm to Bun

> Local frontend ADR series (see backend series in `creative-mode/kixi#conceptual/adr`).
> Same format, independent numbering.

## Status

Proposed — open for team discussion. No migration has started.

## Context

The frontend repo holds three Next.js apps with three independent installs:

- root (manager/admin) — `package-lock.json`, dev port 3002
- `student/` — own `package-lock.json`, dev port 3003
- `landing/` — own `package-lock.json`, dev port 3004

plus a gateway (`scripts/gateway.mjs`, port 3000) and orchestration that shells
out to npm (`scripts/dev-all.mjs` uses `npm --prefix … run dev`).

Pain points observed (see issue #77):

- three full `node_modules` trees (~3x disk, ~3x install time, three lockfiles
  that can drift apart);
- real drift, checked 08/10 on DEV: `lucide-react` is `^0.468.0` at root
  against `^1.52.0` in `student/` — a **major** apart, so any package manager
  installs two copies — and `next` is `^16.3.8` at root against `^16.0.10`
  in `student/` and `landing/`. (The radix sets differ per app because each
  app genuinely uses different components — that split is normal, not drift.
  `react` is pinned to `19.2.1` everywhere — fine.)
- `npm run dev:all` and the Dockerfiles assume npm;
- contributor onboarding is `npm install` x3.

Workspaces alone do not align versions: with `lucide-react` on two majors,
npm, pnpm or Bun all install two copies. So step zero of any migration —
with Bun or without — is aligning these versions by hand first.

Bun 1.4.0 was verified on the author's machine (measured 07/10, see table
below) and offers workspaces with a single `bun.lock`, a drop-in `bun run` /
`bun install` CLI, and can run the gateway and scripts directly
(`bun scripts/gateway.mjs`).

Out of scope honesty: switching package managers does **not** fix the native
`Bus error` seen on `next build` in this sandbox (issue #77) — that crash
happens inside Next's SWC native binding regardless of npm or Bun. The build
question is tracked separately.

## Decision drivers

- one lockfile, one install command for the three apps;
- faster CI and local setup;
- minimal churn in Docker, Vercel deploys, and `dev-all` scripts;
- every contributor must install Bun (extra toolchain besides Node).

## Options considered

### A. Stay on npm, optionally with npm workspaces

npm workspaces already give a single root lockfile and a single install
without asking anyone to install another toolchain. Said plainly: if the
goal is "one lockfile, one command", npm workspaces get us there. What
would still be left on the table for Bun is install speed (measured below)
and the shared global cache — that is the honest comparison for the team.

### B. Migrate to Bun workspaces (proposed for discussion)

- `package.json` workspaces: `[".", "student", "landing"]` (or move apps under `apps/`);
- single `bun.lock`, delete the three `package-lock.json`;
- `bun install` once at root; `bun --filter <pkg> dev` in `dev-all.mjs`;
- Docker: `oven/bun` base image (or multi-stage: install with Bun, run with Node);
- CI: `oven-sh/setup-bun` + `bun install --frozen-lockfile`;
- pin the version (`bun --version`, e.g. 1.4.x) and document it in the README.

### C. Migrate to pnpm workspaces

Same workspace benefits, content-addressable store, slower than Bun but closer
to npm semantics. Listed for completeness; nobody on the team proposed it.

## Consequences (if B is accepted)

### Positive

- one command setup (`bun install`), one lockfile;
- faster reinstalls on warm cache (measured below); shared global cache
  across the three apps;
- `dev-all`, gateway and scripts runnable with `bun` directly.

Measured 07/10 on this machine, root app, same network (bun 1.4.0, npm 10):

| | `npm ci --no-audit --no-fund` | `bun install` |
| --- | --- | --- |
| cold cache | 1m50s | 2m46s (slower cold — honest) |
| warm cache | 9s | 0.4s (~20x) |

So the "10–30x" claim only holds for warm-cache reinstalls — the everyday
case, but not the first clone.

### Negative

- new required toolchain (Bun) next to Node — onboarding docs, Dockerfiles,
  and CI all change at once;
- `package-lock.json` history is lost (fresh resolve; versions may shift —
  needs a lockfile review PR);
- some lifecycle scripts / native postinstalls occasionally behave
  differently under Bun (must be verified per dependency);
- Vercel: Bun support exists but the Node runtime remains the safer default
  for deploys — needs an explicit decision per app.

## Migration surface (if B is accepted)

Files that mention npm today and would change:

- `vercel.json` — `installCommand: npm install` (plus `buildCommand`/`devCommand`);
- `docker/app.Dockerfile` — `RUN npm ci`, `RUN npm run build`;
- `scripts/dev-all.mjs` — spawns `npm --prefix … run dev`;
- the three `package-lock.json` → one `bun.lock` (fresh resolve, versions may
  shift — needs a lockfile review PR).
- `docker/app.Dockerfile` + `docker-compose.yml` — this is probably the most
  laborious part, and it applies to option A too: today each image copies
  `${APP_DIR}/package.json` + `${APP_DIR}/package-lock.json` and runs its
  own `npm ci`. With workspaces there is no per-app lockfile — the single
  root lockfile plus every workspace's `package.json` have to enter the
  build context, and the `args` change with them.
- CI: `quality.yml` (merged as #97) also joins this list — it runs `npm ci`
  in three folders (root, `student/`, `landing/`), each with its own
  `cache-dependency-path`.

## Open questions for the team

1. Bun workspaces at root, or also restructure (`apps/manager`, …)?
2. Docker: `oven/bun` runtime or Bun-only-for-install + Node runtime?
3. Vercel projects: switch runtime to Bun or keep Node?
4. Who owns the migration PR (lockfile review is the risky part)?
5. Minimum Bun version to pin?

## Decision summary

No decision yet. The version drift is fixed by aligning versions by hand,
with or without workspaces — so the real choice before the team is npm
workspaces versus Bun, judged on setup speed and toolchain cost, with the
migration PR owned by whoever the team assigns after the discussion.
