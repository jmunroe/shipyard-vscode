# Changelog

All notable changes to the Shipyard VS Code extension are documented here.
The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [0.4.0] - 2026-06-23

### Added

- **Shipyard viewer webview** (F007): clicking an entity node (feature, epic,
  task, bug, idea, or the sprint goal) now opens a rendered viewer — frontmatter
  as labelled, status-coloured chips and the Markdown body rendered via
  markdown-it — instead of the raw `.md`. Cross-references (epic, dependencies,
  graduated_to, tasks, children) are clickable links that re-render the same
  reused panel; dangling refs show as muted text and `external_refs` stay plain.
  A new `shipyard.openBehavior` setting (`preview` default | `editor`) and an
  "Open raw file" context action keep the raw file one click away. The viewer
  reuses the dashboard's hardened no-script CSP shell (`enableScripts: false`,
  `enableCommandUris: true`), live-refreshes on edit (debounced), and shows a
  graceful "no longer exists" state when the underlying file is deleted.

### Security

- The viewer sanitizes Markdown body link schemes (allowlist — `command:`,
  `javascript:`, `data:`, `file:` are rejected) so untrusted `.shipyard` content
  cannot inject a live `command:` URI into the command-enabled webview.

## [0.3.0] - 2026-06-22

### Added

- **Terminal control surface** (F005): send `/shipyard:ship-*` slash commands to a
  terminal from sidebar title-bar buttons and the command palette
  (Status / Sprint / Backlog / Execute / Review), plus context-menu actions —
  "Discuss in Shipyard" (feature/idea/epic → `ship-discuss <id>`) and
  "Debug in Shipyard" (bug → `ship-debug <id>`). New settings:
  `shipyard.autoRunCommands` (type vs. execute, default type),
  `shipyard.terminalTarget` (`dedicated`/`active`, default a managed "Shipyard"
  terminal), and `shipyard.launchCommand` + `shipyard.launchDelayMs` to launch
  Claude Code on cold start. The extension types into your terminal only — it never
  writes `.shipyard` or shells out to the plugin CLI.
- **Velocity trends** (F004): a new dashboard section charting completed
  story-points per ISO calendar week (inline SVG, no dependencies), with per-epic
  trajectory, an "approximate (based on last-updated dates)" disclosure, and a
  "not enough history yet" state. Derived purely from the in-memory model.

## [0.2.1] - 2026-06-20

### Added

- **CI release workflow** (`.github/workflows/release.yml`): pushing a `vX.Y.Z`
  tag runs the standing gates (typecheck, compile, smoke against a committed
  `test/fixtures/.shipyard`), guards that the tag matches `package.json`,
  publishes to the VS Code Marketplace, and creates a GitHub Release with the
  packaged `.vsix` and CHANGELOG-derived notes. See `PUBLISHING.md`. (F006)

### Fixed

- Graduated ideas (promoted to features via `/ship-discuss`) are no longer
  counted in the dashboard's "Pending ideas" total or shown in the Spec tree,
  matching Shipyard's own listings.

## [0.2.0] - 2026-06-20

### Added

- **Shipyard: Open Dashboard** — a webview dashboard mirroring `ship-status`:
  overall completion %, features-by-status, per-epic progress bars, sprint goal +
  per-wave task counts, and open-bug / pending-idea counts. Theme-adaptive
  (`var(--vscode-*)`), HTML-escaped, accessible progress bars, debounced live
  refresh, and a friendly empty state. Opens from the command palette or a
  sidebar title-bar button.

### Fixed

- Live refresh now fires for projects whose `.shipyard/` is a symlink into the
  plugin data store (the normal Shipyard layout). Previously the watcher did not
  follow the symlink outside the workspace, so the tree views and dashboard only
  updated on a manual **Shipyard: Refresh**.

## [0.1.0] - 2026-06-20

First public release on the VS Code Marketplace.

### Added

- Read-only Shipyard sidebar with four native tree views — **Sprint**, **Backlog**,
  **Spec**, and **Bugs** — rendered directly from a project's `.shipyard/` Markdown
  files (parsed with `gray-matter`, no shell-out to the Shipyard CLI).
- Activity-bar container with an on-brand gantry-crane icon (theme-adaptive
  monochrome mark in the sidebar; a `#0E639C` Marketplace tile).
- Live refresh: a file-system watcher on `**/.shipyard/**` reloads the views on
  any change, plus a manual **Shipyard: Refresh** command.
- **Shipyard: Open Project Config** command.
- A welcome view that points to Shipyard when no `.shipyard/` project is present
  in the workspace.

[0.2.0]: https://github.com/jmunroe/shipyard-vscode/releases/tag/v0.2.0
[0.1.0]: https://github.com/jmunroe/shipyard-vscode/releases/tag/v0.1.0
