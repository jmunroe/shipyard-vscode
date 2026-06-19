---
paths: ["esbuild.mjs", "src/**/*.ts", "package.json"]
---
# esbuild bundling: vscode is the only external

`vscode` is the ONLY module allowed in esbuild's `external` array. Bundle
everything else into `dist/extension.js` — including `gray-matter` and any new
runtime dependency.

**Why:** the published `.vsix` ships only `dist/extension.js`, not
`node_modules`. Anything marked external but not provided by the VS Code host
(only `vscode` is) becomes a `Cannot find module` crash at activation time on a
user's machine — invisible in local dev where `node_modules` exists.

When adding a dependency, add it to `dependencies` (so it installs for bundling)
and leave it bundled. Do not add it to `external`.
