# Publishing shipyard-vscode

Releases are automated by `.github/workflows/release.yml`: **pushing a `vX.Y.Z`
tag** publishes the extension to the VS Code Marketplace and creates a matching
GitHub Release. There is no manual `vsce publish` step in the normal flow.

## One-time setup: the `VSCE_PAT` secret

The publish step authenticates with an Azure DevOps Personal Access Token stored
as the repository secret **`VSCE_PAT`** (Settings → Secrets and variables →
Actions).

1. Sign in at <https://dev.azure.com> with the account that owns the `earthdata`
   publisher.
2. Create a PAT with **Organization: All accessible organizations** and the
   **Marketplace → Manage** scope.
3. Save it as the `VSCE_PAT` repository secret.

PATs expire (max ~1 year). When the publish step 401s, rotate the token and
update the secret — that is the expected failure mode, not a code change. (See
the publish-runbook idea, IDEA-007.)

## Cutting a release

1. Bump `version` in `package.json`.
2. Add a `## [X.Y.Z] - YYYY-MM-DD` section to `CHANGELOG.md` (the workflow draws
   the GitHub Release notes from it, and fails if the section is missing).
3. Commit both, then tag and push. Use an **annotated** tag (`-a`) — this repo's
   git config rejects lightweight tags with "fatal: no tag message?":
   ```sh
   git tag -a vX.Y.Z -m "Release vX.Y.Z"
   git push && git push --tags
   ```
4. Watch the **Release** workflow in the Actions tab. It guards that the tag
   matches `package.json`, runs typecheck + compile + smoke (against
   `test/fixtures/.shipyard`), packages the `.vsix`, publishes, and creates the
   GitHub Release with the `.vsix` attached.

A normal commit with no tag never triggers a publish. If a tag's version does not
match `package.json`, the workflow fails before publishing.

## Out of scope

Open VSX publishing (IDEA-011) is not wired up yet; this workflow targets the
Microsoft Marketplace only.
