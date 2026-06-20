# Changelog

All notable changes to the Shipyard VS Code extension are documented here.
The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

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

[0.1.0]: https://github.com/jmunroe/shipyard-vscode/releases/tag/v0.1.0
