---
paths: [".git/**/*"]
---
# Commit Message Format

This project uses **freeform** commit messages (no Conventional Commits, no
emoji, no ticket prefixes). Follow these conventions:

Format: a concise imperative/descriptive subject line. A `topic: detail` prefix
is acceptable when it reads naturally (e.g. "Initial scaffold: ...").
Case: sentence case — capitalize the first word.
Scopes: none (no `feat(scope):`-style scopes).

Examples from this project:
- "Add CLAUDE.md with architecture and dev workflow"
- "Initial scaffold: read-only Shipyard sidebar for VS Code"

Note: the user's standing rule is to commit freely while working but **never
`git push` without explicit approval**.
