import * as vscode from 'vscode';
import * as fs from 'fs';
import { ShipyardStore } from './store';
import { DashboardPanel } from './dashboard';
import { ViewerPanel } from './viewer';
import { findEntity } from './viewer/resolve';
import { sendToTerminal } from './terminal';
import {
  BacklogProvider,
  BugsProvider,
  ShipyardNode,
  SpecProvider,
  SprintProvider,
} from './views';

/** Resolve an entity id to its file and open it in the raw text editor. */
async function openRaw(store: ShipyardStore, itemId: string): Promise<void> {
  const item = findEntity(store.getData(), itemId);
  if (!item) {
    vscode.window.showInformationMessage(`Shipyard: ${itemId} no longer exists.`);
    return;
  }
  await vscode.window.showTextDocument(vscode.Uri.file(item.filePath));
}

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
    // Entity-node click target (also reused by T020's cross-ref command: URIs).
    // `preview` (default) opens the rendered viewer; `editor` opens the raw .md.
    vscode.commands.registerCommand('shipyard.openItem', async (itemId?: string) => {
      if (!itemId) return;
      const behavior = vscode.workspace
        .getConfiguration('shipyard')
        .get<string>('openBehavior', 'preview');
      if (behavior === 'editor') {
        await openRaw(store, itemId);
        return;
      }
      ViewerPanel.show(store, itemId);
    }),
    // Context action: always open the raw .md regardless of openBehavior.
    vscode.commands.registerCommand('shipyard.openRawFile', async (node?: ShipyardNode) => {
      if (!node?.itemId) return;
      await openRaw(store, node.itemId);
    }),
  );

  // Global send commands: each types its mapped plugin-namespaced slash command
  // into the active terminal (T010's sendToTerminal). Keep this map in sync with
  // the view/title contributions in package.json.
  const sendCommands: Record<string, string> = {
    'shipyard.sendStatus': '/shipyard:ship-status',
    'shipyard.sendSprint': '/shipyard:ship-sprint',
    'shipyard.sendBacklog': '/shipyard:ship-backlog',
    'shipyard.sendExecute': '/shipyard:ship-execute',
    'shipyard.sendReview': '/shipyard:ship-review',
  };
  for (const [commandId, slash] of Object.entries(sendCommands)) {
    context.subscriptions.push(
      vscode.commands.registerCommand(commandId, () => sendToTerminal(slash)),
    );
  }

  // Context-aware send commands: invoked from view/item/context menus, they
  // receive the clicked ShipyardNode and send an item-scoped slash command using
  // its itemId (T011). Null-check itemId so container/info nodes are inert.
  context.subscriptions.push(
    vscode.commands.registerCommand('shipyard.discussItem', (node?: ShipyardNode) => {
      if (!node?.itemId) return;
      sendToTerminal(`/shipyard:ship-discuss ${node.itemId}`);
    }),
    vscode.commands.registerCommand('shipyard.debugBug', (node?: ShipyardNode) => {
      if (!node?.itemId) return;
      sendToTerminal(`/shipyard:ship-debug ${node.itemId}`);
    }),
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
