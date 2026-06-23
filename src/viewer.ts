import * as vscode from 'vscode';
import { ShipyardStore } from './store';
import { findEntity } from './viewer/resolve';
import { renderViewer, renderMissing } from './viewer/render';

/** Trailing debounce (ms) — coalesce the watcher's burst of events per write. */
const REFRESH_DEBOUNCE_MS = 100;

/**
 * The Shipyard viewer webview — a single `WebviewPanel` that renders one entity
 * (frontmatter as chips, Markdown body, clickable cross-references). Singleton:
 * clicking another node re-renders this same panel rather than opening a second
 * tab. Mirrors `DashboardPanel` (singleton + debounced live-refresh + hardened
 * no-script CSP shell); it differs only by `enableCommandUris: true` (so the
 * cross-ref `command:` links work) and the per-item `show(store, itemId)` API.
 *
 * T018 scope is the walking skeleton: the panel, the singleton, command wiring,
 * and a placeholder body. The rich body (T019) and cross-ref navigation +
 * edge/deleted/live-refresh states (T020) render into this container later.
 */
export class ViewerPanel {
  private static readonly viewType = 'shipyardViewer';
  private static current: ViewerPanel | undefined;

  private readonly disposables: vscode.Disposable[] = [];
  private refreshTimer: ReturnType<typeof setTimeout> | undefined;
  /** The id of the entity currently shown — re-resolved against the store on render. */
  private itemId: string;

  /** Open the viewer on `itemId`, or reveal + re-point the existing panel. */
  static show(store: ShipyardStore, itemId: string): void {
    if (ViewerPanel.current) {
      ViewerPanel.current.itemId = itemId;
      ViewerPanel.current.panel.reveal(vscode.ViewColumn.Active);
      ViewerPanel.current.render();
      return;
    }
    const panel = vscode.window.createWebviewPanel(
      ViewerPanel.viewType,
      'Shipyard Viewer',
      vscode.ViewColumn.Active,
      { enableScripts: false, enableCommandUris: true, retainContextWhenHidden: true },
    );
    ViewerPanel.current = new ViewerPanel(panel, store, itemId);
  }

  private constructor(
    private readonly panel: vscode.WebviewPanel,
    private readonly store: ShipyardStore,
    itemId: string,
  ) {
    this.itemId = itemId;
    this.panel.onDidDispose(() => this.dispose(), null, this.disposables);
    // Live refresh: re-render the current item on any store change, debounced so
    // a single write (which fires many undebounced watcher events) renders once.
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

  /** Read-only: resolve the current item from the store and write the HTML. */
  private render(): void {
    const data = this.store.getData();
    const item = findEntity(data, this.itemId);
    // Deleted-while-open: the tracked item vanished after a store refresh.
    if (!item) {
      this.panel.title = 'Shipyard Viewer';
      this.panel.webview.html = renderMissing(this.itemId);
      return;
    }
    this.panel.title = `Shipyard: ${item.id}`;
    this.panel.webview.html = renderViewer(item, data);
  }

  private dispose(): void {
    ViewerPanel.current = undefined;
    if (this.refreshTimer) {
      clearTimeout(this.refreshTimer);
      this.refreshTimer = undefined;
    }
    while (this.disposables.length) {
      this.disposables.pop()?.dispose();
    }
  }
}
