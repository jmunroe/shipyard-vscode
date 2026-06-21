# Changelog

All notable changes to the Shipyard VS Code extension are documented here.
The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

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
