import * as vscode from 'vscode';
import { findShipyardDir } from './shipyard/paths';
import { loadProject } from './shipyard/repository';
import { ProjectData } from './shipyard/model';

/**
 * Central data store: locates `.shipyard`, loads the project model, caches it,
 * and notifies tree views when it changes. A single instance is shared by all
 * four views so a refresh re-reads disk exactly once.
 */
export class ShipyardStore {
  private readonly _onDidChange = new vscode.EventEmitter<void>();
  readonly onDidChange = this._onDidChange.event;

  private data: ProjectData | undefined;
  private dir: string | undefined;

  get shipyardDir(): string | undefined {
    return this.dir;
  }

  getData(): ProjectData | undefined {
    return this.data;
  }

  async refresh(): Promise<void> {
    this.dir = findShipyardDir();
    this.data = this.dir ? await loadProject(this.dir) : undefined;
    await vscode.commands.executeCommand('setContext', 'shipyard.hasProject', !!this.dir);
    this._onDidChange.fire();
  }

  dispose(): void {
    this._onDidChange.dispose();
  }
}
