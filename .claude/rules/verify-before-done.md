---
paths: ["src/**/*.ts", "test/**/*.ts", "esbuild.mjs", "tsconfig.json"]
---
# Verify before claiming done

This project has no unit-test framework. "Done" means verified by running:

1. `npm run typecheck` — `tsc --noEmit` (strict). Must pass with zero errors.
2. `npm run compile` — esbuild bundle must succeed.
3. `npm run smoke -- .shipyard` — run when the parser, model, or repository
   changed; confirms a real `.shipyard` still parses. (The repo's own
   `.shipyard` symlink is a valid target.)

Do not report work as complete on the basis of reading the code alone — run the
checks and report actual results. If you skip one, say so explicitly.
