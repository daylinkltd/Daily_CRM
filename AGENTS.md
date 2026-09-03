<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

<!-- BEGIN:project-context -->
# Read HANDOFF.md before you start

[`HANDOFF.md`](HANDOFF.md) is this project's context brief. It carries the
things you cannot recover from the code or the git log: hard rules (DDL is
never run from code, which account can push, what the build gates are),
the current database migration state, decisions already settled with their
reasons, traps that have already cost a session, and the open work list.

Read it first, then start from its **Open work** section. When you finish a
significant piece of work, update it — a stale brief is worse than none,
and this file has been badly stale once already.
<!-- END:project-context -->
