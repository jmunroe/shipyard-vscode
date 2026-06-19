---
paths: ["src/shipyard/model.ts"]
---
# model.ts is pure types — zero imports

`src/shipyard/model.ts` is the typed view of the on-disk Shipyard model. It must
contain **only type/interface declarations and have no imports** — not `vscode`,
not node builtins, not gray-matter, nothing.

**Why:** it is the single source of truth for the on-disk data contract, shared
by the parser (`repository.ts`), the store, and the views. Keeping it
import-free means the on-disk schema never gets coupled to a runtime API, stays
trivially testable (the smoke test bundles it without VS Code), and can't drag
side effects into the bundle. Runtime concerns (VS Code `TreeItem`s, file I/O)
live in `views.ts`, `repository.ts`, and `store.ts` — never here.
