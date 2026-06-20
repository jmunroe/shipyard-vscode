import * as vscode from 'vscode';
import * as fs from 'fs';
import { ShipyardStore } from './store';
import { DashboardPanel } from './dashboard';
import {
  BacklogProvider,
  BugsProvider,
  SpecProvider,
  SprintProvider,
} from './views';

export async function activate(context: vscode.ExtensionContext): Promise<void> {
  const store = new ShipyardStore();
  context.subscriptions.push(store);

  const providers = {
    'shipyard.sprint': new SprintProvider(store),
    'shipyard.backlog': new BacklogProvider(store),
    'shipyard.spec': new SpecProvider(store),
    'shipyard.bugs': new BugsProvider(store),
  };
  for (const [viewId, provider] of Object.entries(providers)) {
    context.subscriptions.push(vscode.window.registerTreeDataProvider(viewId, provider));
  }

  context.subscriptions.push(
    vscode.commands.registerCommand('shipyard.refresh', () => store.refresh()),
    vscode.commands.registerCommand('shipyard.openConfig', async () => {
      if (!store.shipyardDir) {
        vscode.window.showInformationMessage('No Shipyard project in this workspace.');
        return;
      }
      const uri = vscode.Uri.joinPath(vscode.Uri.file(store.shipyardDir), 'config.md');
      await vscode.window.showTextDocument(uri);
    }),
    vscode.commands.registerCommand('shipyard.openDashboard', () => DashboardPanel.show(store)),
  );

  // Auto-refresh when any Shipyard file changes on disk.
  const onChange = () => store.refresh();
  const watch = (pattern: vscode.GlobPattern): void => {
    const w = vscode.workspace.createFileSystemWatcher(pattern);
    w.onDidChange(onChange);
    w.onDidCreate(onChange);
    w.onDidDelete(onChange);
    context.subscriptions.push(w);
  };

  // Workspace-relative watcher: handles a real (non-symlink) .shipyard and
  // catches creation/deletion of the .shipyard entry itself.
  watch('**/.shipyard/**');

  await store.refresh();

  // Shipyard normally stores its data under the plugin cache and symlinks
  // `<workspace>/.shipyard` to it. VS Code's recursive watcher does not follow a
  // symlink that points outside the workspace, so the glob above never sees
  // writes to the real target — live refresh would silently never fire. Add an
  // absolute watcher on the resolved target directory to cover that (the common)
  // case. See also paths.findShipyardDir, which returns the symlink path.
  if (store.shipyardDir) {
    try {
      const realDir = fs.realpathSync(store.shipyardDir);
      if (realDir !== store.shipyardDir) {
        watch(new vscode.RelativePattern(vscode.Uri.file(realDir), '**'));
      }
    } catch {
      // Broken/unreadable symlink — the workspace-relative watcher still stands.
    }
  }
}

export function deactivate(): void {
  // Disposables are cleaned up via context.subscriptions.
}
