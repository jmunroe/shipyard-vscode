---
paths: ["src/**/*.ts"]
---
# Read .shipyard files directly — never shell out

This extension is **read-only in v1** and reads `.shipyard/` Markdown files
directly (parsed with `gray-matter`). Do NOT shell out to `shipyard-context`,
`shipyard-data`, or any Shipyard CLI from extension code, and do NOT add code
that writes to or mutates `.shipyard/`.

**Why:** the CLI lives at a versioned plugin path
(`~/.claude/plugins/cache/acendas/shipyard/<ver>/bin`) and needs a resolver env,
so depending on it is fragile across plugin updates and absent for users who
don't have the plugin installed. Reading the on-disk format (stable,
template-defined) works for anyone with a `.shipyard` repo. See CLAUDE.md
"Core design decision".

Frontmatter schemas mirror the Shipyard plugin templates
(`templates/feature.md`, `task.md`, `SPRINT.md`, etc.).
