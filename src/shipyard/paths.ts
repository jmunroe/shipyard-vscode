import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';

/**
 * Locate the `.shipyard` data directory for the current workspace.
 * Shipyard places it at the repo root; it may be a real directory or a
 * symlink into the plugin's data store — statSync follows symlinks, so
 * both resolve here. Returns the first match across workspace folders.
 */
export function findShipyardDir(): string | undefined {
  const folders = vscode.workspace.workspaceFolders;
  if (!folders) {
    return undefined;
  }
  for (const folder of folders) {
    const candidate = path.join(folder.uri.fsPath, '.shipyard');
    try {
      if (fs.statSync(candidate).isDirectory()) {
        return candidate;
      }
    } catch {
      // not present in this folder — keep looking
    }
  }
  return undefined;
}
