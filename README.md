# Shipyard for VS Code

Visualize your [Shipyard](https://github.com/Acendas/shipyard) sprint, backlog, and
product spec directly in the VS Code sidebar — without leaving your editor or
re-running `/ship-status` in the terminal.

Shipyard stores all of its state as Markdown files under a `.shipyard/` folder at
your repo root. This extension reads those files directly (no plugin binary or
network required) and renders them as native tree views that update as you work.

## Features

A **Shipyard** container appears in the Activity Bar with four views:

- **Sprint** — the current sprint goal, status, and waves, with per-task status
  and a done/total count per wave.
- **Backlog** — RICE-ranked features, each showing rank, story points, and score.
- **Spec** — epics with their features grouped underneath, plus ungrouped
  features and the idea inbox. Completion is rolled up per epic.
- **Bugs** — open bugs with severity and status.

Every item shows a status icon (✓ done · ↻ in-progress · ⚠ needs-attention ·
✕ blocked · ○ proposed) and opens the underlying `.md` file on click. Views
refresh automatically when any file under `.shipyard/` changes.

This v1 is read-only — it visualizes state but does not run Shipyard commands.

## Requirements

- VS Code 1.90 or newer.
- A workspace containing a `.shipyard/` directory (created by `/ship-init`).

## Development

```sh
npm install
npm run compile      # bundle to dist/ via esbuild
npm run watch        # rebuild on change
npm run typecheck    # tsc --noEmit
```

Press **F5** in VS Code to launch an Extension Development Host with the
extension loaded. Open a folder that contains a `.shipyard/` directory to see
the views populate.

### Packaging

```sh
npm run package      # produces a .vsix via @vscode/vsce
```

## How it works

| Source file                          | View          |
| ------------------------------------ | ------------- |
| `sprints/current/SPRINT.md`          | Sprint        |
| `spec/tasks/*.md`                    | Sprint (tasks)|
| `backlog/BACKLOG.md` + `spec/features/*.md` | Backlog |
| `spec/epics/*.md`, `spec/features/*.md`, `spec/ideas/*.md` | Spec |
| `spec/bugs/*.md`                     | Bugs          |
| `config.md`                          | Project name  |

Frontmatter is parsed with [`gray-matter`](https://github.com/jonschlinkert/gray-matter);
the schemas mirror the Shipyard plugin templates.

## Credits

Built by **James Munroe** at **Earthdata Associates**.

## License

MIT © James Munroe (Earthdata Associates)
