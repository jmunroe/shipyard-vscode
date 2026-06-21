---
project_name: "Fixture Project"
---

# Fixture Project

Minimal Shipyard data used only by the CI smoke gate (`.github/workflows/release.yml`).
The repo's own `.shipyard/` is a developer-local symlink into the plugin cache and
is absent on CI runners, so this committed fixture stands in for it.
