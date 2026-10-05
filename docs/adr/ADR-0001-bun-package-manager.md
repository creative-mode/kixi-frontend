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
  that can drift apart, e.g. `@radix-ui/*` present at root but missing in `student/`);
- `npm run dev:all` and the Dockerfiles assume npm;
- contributor onboarding is `npm install` x3.

Bun 1.4.x is available on team machines and offers workspaces with a single
`bun.lock`, much faster installs (global module cache), and a drop-in
`bun run` / `bun install` CLI. Bun can also run the gateway and scripts
directly (`bun scripts/gateway.mjs`).

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

### A. Stay on npm (status quo)

Keep three `package-lock.json` files. Optionally soften the pain with npm
workspaces (single root lockfile) without changing toolchain.

### B. Migrate to Bun workspaces (proposed for discussion)

- `package.json` workspaces: `[".", "student", "landing"]` (or move apps under `apps/`);
- single `bun.lock`, delete the three `package-lock.json`;
- `bun install` once at root; `bun --filter … run dev` in `dev-all.mjs`;
- Docker: `oven/bun` base image (or multi-stage: install with Bun, run with Node);
- CI: `oven-sh/setup-bun` + `bun install --frozen-lockfile`;
- pin the version (`bun --version`, e.g. 1.4.x) and document it in the README.

### C. Migrate to pnpm workspaces

Same workspace benefits, content-addressable store, slower than Bun but closer
to npm semantics. Listed for completeness; nobody on the team proposed it.

## Consequences (if B is accepted)

### Positive

- one command setup (`bun install`), one lockfile, no drift between apps;
- 10–30x faster installs; shared global cache across the three apps;
- `dev-all`, gateway and scripts runnable with `bun` directly.

### Negative

- new required toolchain (Bun) next to Node — onboarding docs, Dockerfiles,
  and CI all change at once;
- `package-lock.json` history is lost (fresh resolve; versions may shift —
  needs a lockfile review PR);
- some lifecycle scripts / native postinstalls occasionally behave
  differently under Bun (must be verified per dependency);
- Vercel: Bun support exists but the Node runtime remains the safer default
  for deploys — needs an explicit decision per app.

## Open questions for the team

1. Bun workspaces at root, or also restructure (`apps/manager`, …)?
2. Docker: `oven/bun` runtime or Bun-only-for-install + Node runtime?
3. Vercel projects: switch runtime to Bun or keep Node?
4. Who owns the migration PR (lockfile review is the risky part)?
5. Minimum Bun version to pin?

## Decision summary

No decision yet. This ADR proposes discussing a Bun workspaces migration to
fix the 3-lockfile drift and slow setup, with the migration PR owned by
whoever the team assigns after the discussion.
