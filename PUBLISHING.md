# Publishing shipyard-vscode

Releases are automated by `.github/workflows/release.yml`: **pushing a `vX.Y.Z`
tag** publishes the extension to the VS Code Marketplace and Open VSX, and creates
a matching GitHub Release. There is no manual `vsce publish`/`ovsx publish` step in
the normal flow.

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

## One-time setup: the `OVSX_PAT` secret (Open VSX)

Open VSX (open-vsx.org) is the registry the VS Code forks — VSCodium, Cursor,
Windsurf — install from. The release workflow publishes the **same `.vsix`** there
as a **best-effort** step (`continue-on-error`): if Open VSX is down, the token is
expired, or the version already exists, the release stays green and the Marketplace
publish + GitHub Release are unaffected. Re-run `ovsx publish` by hand to recover
parity.

This setup is done once, out of band — the workflow does **not** create the
namespace on each release:

1. Sign the **Eclipse Foundation Open VSX Publisher Agreement**: create an
   eclipse.org account with your **GitHub username** filled in, log in at
   <https://open-vsx.org> via that same GitHub account, connect the Eclipse account
   on your profile page, then sign the agreement. Publishing 401/403s without it.
2. Create an Open VSX access token on your open-vsx.org profile page and save it as
   the **`OVSX_PAT`** repository secret. (Label the token something descriptive like
   `shipyard-vscode-ci`; the GitHub secret name must be exactly `OVSX_PAT`.)
3. Claim the namespace once (matches `publisher` in `package.json`):
   ```sh
   npx ovsx create-namespace earthdata -p "$OVSX_PAT"
   ```
   It starts unverified (no checkmark); publishing works regardless.

`OVSX_PAT` expires like `VSCE_PAT` — rotate it the same way when the Open VSX step
starts failing auth.

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

Nothing pending — the workflow targets both the Microsoft Marketplace and Open VSX.
