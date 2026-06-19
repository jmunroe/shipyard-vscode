import * as vscode from 'vscode';
import { ShipyardStore } from './store';
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
  );

  // Auto-refresh when any Shipyard file changes on disk.
  const watcher = vscode.workspace.createFileSystemWatcher('**/.shipyard/**');
  const onChange = () => store.refresh();
  watcher.onDidChange(onChange);
  watcher.onDidCreate(onChange);
  watcher.onDidDelete(onChange);
  context.subscriptions.push(watcher);

  await store.refresh();
}

export function deactivate(): void {
  // Disposables are cleaned up via context.subscriptions.
}
