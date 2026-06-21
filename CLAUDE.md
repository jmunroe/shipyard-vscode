# shipyard-vscode

A VS Code extension that visualizes a [Shipyard](https://github.com/Acendas/shipyard)
project (sprint, backlog, spec, bugs) as native sidebar tree views. Shipyard is a
Claude Code plugin that runs a spec-driven agile lifecycle and stores all its
state as Markdown-with-frontmatter under a `.shipyard/` directory at the repo root.

This extension is **read-only** in v1: it visualizes that state, it does not run
Shipyard commands.

## Core design decision: read files, don't shell out

Shipyard ships a `shipyard-context view <section>` CLI, but it lives at a
versioned plugin path (`~/.claude/plugins/cache/acendas/shipyard/<ver>/bin`) and
needs a resolver env, so depending on it is fragile across plugin updates. We
**read the `.shipyard/` Markdown files directly** instead. This only depends on
the on-disk format (stable, template-defined) and works for anyone with a
`.shipyard` repo regardless of how/whether they have the plugin installed.

Frontmatter is parsed with `gray-matter`. The frontmatter schemas mirror the
Shipyard plugin templates (`templates/feature.md`, `task.md`, `SPRINT.md`, etc.).

## Architecture

```
src/
  extension.ts          activate(): wires store + 4 tree providers + file watcher
  store.ts              ShipyardStore: locates .shipyard, loads + caches the model,
                        fires onDidChange (one shared instance for all views)
  views.ts              ShipyardNode + TreeProviderBase + the 4 providers
  shipyard/
    model.ts            typed view of the on-disk model (pure types, no imports)
    paths.ts            findShipyardDir() — resolves <workspace>/.shipyard (symlink-aware)
    repository.ts       loadProject(dir): parses all Markdown into ProjectData
test/
  smoke.ts              standalone parser check against a real .shipyard dir
```

Data flow: `extension.activate` → `store.refresh()` → `findShipyardDir()` +
`loadProject()` → `ProjectData` cached in store → `onDidChange` fires → each
`TreeProviderBase` re-emits `onDidChangeTreeData` → providers rebuild nodes from
`store.getData()`. A `FileSystemWatcher` on `**/.shipyard/**` triggers refresh on
any change.

### Source file → view mapping

| Source                                                      | View           |
| ----------------------------------------------------------- | -------------- |
| `sprints/current/SPRINT.md` (frontmatter + `### Wave N`)    | Sprint         |
| `spec/tasks/*.md`                                           | Sprint (tasks) |
| `backlog/BACKLOG.md` (`\| rank \| id \|` table) + features  | Backlog        |
| `spec/epics/*.md`, `spec/features/*.md`, `spec/ideas/*.md`  | Spec           |
| `spec/bugs/*.md`                                            | Bugs           |
| `config.md` (`project_name`)                                | (project name) |

### Status taxonomy (drives `statusIcon` in views.ts)

- Features: `proposed | approved | in-progress | done | deployed | released | cancelled`
- Tasks: `pending | in-progress | done | blocked | needs-attention | approved`
- Ideas: `proposed | graduated` — that's the whole lifecycle. Graduating an idea
  (via `/ship-discuss`) sets `status: graduated` + `graduated_to: FNNN` and leaves
  the file in place (Shipyard soft-deletes; physical removal is manual). We hide
  graduated ideas from the Spec tree and the dashboard's "Pending ideas" count,
  matching Shipyard's own listings (`RESOLVED_IDEA_STATUSES` in dashboard/model.ts).

Reference for the full dashboard logic (a good spec if/when we build a webview
dashboard): the plugin's `skills/ship-status/SKILL.md`.

## Build / test / run

```sh
npm install
npm run compile      # esbuild bundle → dist/extension.js (vscode external, cjs)
npm run watch        # rebuild on change
npm run typecheck    # tsc --noEmit (strict)
npm run package      # production bundle + vsce package → .vsix
npm run smoke -- <path-to-.shipyard>   # parse a real .shipyard, print a summary
```

- **F5** in VS Code launches an Extension Development Host; open a folder that
  contains `.shipyard/` to see the views populate.
- **Smoke-test the parser** against real data (no VS Code needed) via `npm run smoke`,
  which wraps the esbuild bundle + node run:
  ```sh
  npm run smoke -- /path/to/repo/.shipyard
  ```
  npm appends the `--`-args to the end of the script, so the path lands on the
  final `node` invocation. The bundle is written to `node_modules/.cache/`. CJS
  format + async-IIFE wrapper are required: `gray-matter` is CJS and esbuild
  rejects top-level await under cjs.

A known-good `.shipyard` to test against: `~/src/clients/stilwaterai/askblaze/.shipyard`.

## Conventions

- TypeScript strict; `tsc` is typecheck-only (`noEmit`), esbuild does the bundling.
- Keep `vscode` as an esbuild external; everything else is bundled.
- `.vscode/launch.json` + `tasks.json` are force-committed (the user's global
  gitignore excludes `.vscode/`) so F5 works on a fresh clone.

## Not done yet (v2 candidates)

- Health & velocity trends on the dashboard (F004) — the webview dashboard
  shipped in v0.2.0 with completion %, epic rollups, and per-wave counts, but
  not trend lines yet.
- Actions that send `/shipyard:ship-*` into the active Claude Code terminal (F005).
```
