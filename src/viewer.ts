import * as vscode from 'vscode';
import { ShipyardStore } from './store';
import { escapeHtml } from './dashboard/render';
import { findEntity } from './viewer/resolve';

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
    const item = findEntity(this.store.getData(), this.itemId);
    this.panel.title = item ? `Shipyard: ${item.id}` : 'Shipyard Viewer';
    // T018 placeholder — the chips + Markdown body land in T019.
    const heading = item
      ? `<h1>${escapeHtml(item.id)}</h1><p>${escapeHtml(item.title)}</p><p class="muted">${escapeHtml(item.status)}</p>`
      : `<h1 class="muted">${escapeHtml(this.itemId)}</h1><p class="muted">This item no longer exists.</p>`;
    this.panel.webview.html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta http-equiv="Content-Security-Policy"
        content="default-src 'none'; style-src 'unsafe-inline'; img-src data:;" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Shipyard Viewer</title>
  <style>
    body { font-family: var(--vscode-font-family); color: var(--vscode-foreground); background: var(--vscode-editor-background); padding: 0 1rem 2rem; line-height: 1.5; }
    h1 { font-size: 1.4rem; margin: 1rem 0 0.25rem; }
    .muted { color: var(--vscode-descriptionForeground); }
  </style>
</head>
<body>
  ${heading}
</body>
</html>`;
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
