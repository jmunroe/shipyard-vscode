import * as vscode from 'vscode';
import { ShipyardStore } from './store';
import { renderDashboard } from './dashboard/render';

/** Trailing debounce (ms) — coalesce the watcher's burst of events per write. */
const REFRESH_DEBOUNCE_MS = 100;

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
  private refreshTimer: ReturnType<typeof setTimeout> | undefined;

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
    // Live refresh: re-render on any store change, debounced so a single
    // sprint write (which fires many undebounced watcher events) renders once.
    this.store.onDidChange(() => this.scheduleRender(), null, this.disposables);
    this.render();
  }

  /** Trailing-debounce a re-render: clear and reset the timer on each event. */
  private scheduleRender(): void {
    if (this.refreshTimer) {
      clearTimeout(this.refreshTimer);
    }
    this.refreshTimer = setTimeout(() => {
      this.refreshTimer = undefined;
      this.render();
    }, REFRESH_DEBOUNCE_MS);
  }

  /** Read-only: reads the store snapshot and writes the webview HTML. */
  private render(): void {
    this.panel.webview.html = renderDashboard(this.store.getData());
  }

  private dispose(): void {
    DashboardPanel.current = undefined;
    if (this.refreshTimer) {
      clearTimeout(this.refreshTimer);
      this.refreshTimer = undefined;
    }
    while (this.disposables.length) {
      this.disposables.pop()?.dispose();
    }
  }
}
