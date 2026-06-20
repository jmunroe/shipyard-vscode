import * as vscode from 'vscode';
import { ShipyardStore } from './store';

/**
 * The Shipyard dashboard webview — a single `WebviewPanel` mirroring the
 * `ship-status` output. Singleton: re-invoking the command reveals the existing
 * panel instead of opening a second one.
 *
 * T006 scope is the walking skeleton: command wiring, the panel, the singleton,
 * a hardened CSP shell, and a placeholder body. Content (T008) and live refresh
 * (T009) render into this container later — which is why the shared
 * `ShipyardStore` is retained here.
 */
export class DashboardPanel {
  private static readonly viewType = 'shipyardDashboard';
  private static current: DashboardPanel | undefined;

  private readonly disposables: vscode.Disposable[] = [];

  /** Open the dashboard, or reveal it if already open. */
  static show(store: ShipyardStore): void {
    if (DashboardPanel.current) {
      DashboardPanel.current.panel.reveal(vscode.ViewColumn.Active);
      return;
    }
    const panel = vscode.window.createWebviewPanel(
      DashboardPanel.viewType,
      'Shipyard Dashboard',
      vscode.ViewColumn.Active,
      { enableScripts: false, retainContextWhenHidden: true },
    );
    DashboardPanel.current = new DashboardPanel(panel, store);
  }

  private constructor(
    private readonly panel: vscode.WebviewPanel,
    private readonly store: ShipyardStore,
  ) {
    this.panel.onDidDispose(() => this.dispose(), null, this.disposables);
    this.render();
  }

  private render(): void {
    this.panel.webview.html = DashboardPanel.shell(
      this.store.shipyardDir ? 'Loading the Shipyard dashboard…' : 'No Shipyard project in this workspace.',
    );
  }

  /**
   * The hardened HTML shell: strict CSP (no scripts; only inline styles), into
   * which T008's rendered markup is dropped. Fully static — no nonce needed.
   */
  private static shell(body: string): string {
    return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta http-equiv="Content-Security-Policy"
        content="default-src 'none'; style-src 'unsafe-inline'; img-src data:;" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Shipyard Dashboard</title>
</head>
<body>
  ${body}
</body>
</html>`;
  }

  private dispose(): void {
    DashboardPanel.current = undefined;
    while (this.disposables.length) {
      this.disposables.pop()?.dispose();
    }
  }
}
