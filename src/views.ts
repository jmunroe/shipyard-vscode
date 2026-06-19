import * as vscode from 'vscode';
import { ShipyardStore } from './store';
import { BaseEntity, Feature, ProjectData, Task } from './shipyard/model';

const Collapsed = vscode.TreeItemCollapsibleState.Collapsed;
const None = vscode.TreeItemCollapsibleState.None;

/** A node in any Shipyard tree. Children are precomputed when the tree builds. */
export class ShipyardNode extends vscode.TreeItem {
  children?: ShipyardNode[];

  constructor(label: string, collapsibleState = None) {
    super(label, collapsibleState);
  }
}

function statusIcon(status?: string): vscode.ThemeIcon {
  switch ((status ?? '').toLowerCase()) {
    case 'done':
    case 'released':
    case 'deployed':
      return new vscode.ThemeIcon('pass-filled', new vscode.ThemeColor('charts.green'));
    case 'in-progress':
      return new vscode.ThemeIcon('sync', new vscode.ThemeColor('charts.blue'));
    case 'blocked':
      return new vscode.ThemeIcon('error', new vscode.ThemeColor('charts.red'));
    case 'needs-attention':
      return new vscode.ThemeIcon('warning', new vscode.ThemeColor('charts.yellow'));
    case 'cancelled':
    case 'obsolete':
      return new vscode.ThemeIcon('circle-slash', new vscode.ThemeColor('disabledForeground'));
    case 'proposed':
      return new vscode.ThemeIcon('lightbulb');
    default:
      return new vscode.ThemeIcon('circle-outline');
  }
}

function openCommand(filePath: string): vscode.Command {
  return { command: 'vscode.open', title: 'Open', arguments: [vscode.Uri.file(filePath)] };
}

function info(message: string, icon = 'info'): ShipyardNode {
  const node = new ShipyardNode(message);
  node.iconPath = new vscode.ThemeIcon(icon);
  return node;
}

/** Build a leaf node for any entity that has an id, title, status and file. */
function entityNode(entity: BaseEntity, description?: string): ShipyardNode {
  const node = new ShipyardNode(`${entity.id}  ${entity.title}`);
  node.description = description ?? entity.status;
  node.tooltip = `${entity.id} — ${entity.title}\nstatus: ${entity.status}`;
  node.iconPath = statusIcon(entity.status);
  node.command = openCommand(entity.filePath);
  node.contextValue = 'shipyardEntity';
  return node;
}

abstract class TreeProviderBase implements vscode.TreeDataProvider<ShipyardNode> {
  private readonly _onDidChangeTreeData = new vscode.EventEmitter<void>();
  readonly onDidChangeTreeData = this._onDidChangeTreeData.event;

  constructor(protected readonly store: ShipyardStore) {
    store.onDidChange(() => this._onDidChangeTreeData.fire());
  }

  getTreeItem(element: ShipyardNode): vscode.TreeItem {
    return element;
  }

  getChildren(element?: ShipyardNode): ShipyardNode[] {
    if (element) {
      return element.children ?? [];
    }
    const data = this.store.getData();
    if (!data) {
      return [info('No Shipyard project found', 'circle-slash')];
    }
    return this.roots(data);
  }

  protected abstract roots(data: ProjectData): ShipyardNode[];
}

export class SprintProvider extends TreeProviderBase {
  protected roots(data: ProjectData): ShipyardNode[] {
    const sprint = data.sprint;
    if (!sprint) {
      return [info('No active sprint — run /ship-sprint', 'rocket')];
    }
    const tasksById = new Map<string, Task>(data.tasks.map((t) => [t.id, t]));

    const goal = new ShipyardNode(sprint.goal || sprint.id);
    goal.description = sprint.status;
    goal.iconPath = new vscode.ThemeIcon('rocket');
    goal.tooltip = `${sprint.id}\nstatus: ${sprint.status}`;
    goal.command = openCommand(sprint.filePath);

    const nodes: ShipyardNode[] = [goal];

    if (sprint.waves.length === 0) {
      nodes.push(info('No waves planned yet', 'list-flat'));
      return nodes;
    }

    sprint.waves.forEach((wave, i) => {
      const waveNode = new ShipyardNode(`Wave ${i + 1}`, Collapsed);
      const doneCount = wave.filter((id) => tasksById.get(id)?.status === 'done').length;
      waveNode.description = `${doneCount}/${wave.length} done`;
      waveNode.iconPath = new vscode.ThemeIcon('layers');
      waveNode.children = wave.map((id) => {
        const task = tasksById.get(id);
        if (!task) {
          const missing = new ShipyardNode(id);
          missing.description = '(no task file)';
          missing.iconPath = new vscode.ThemeIcon('question');
          return missing;
        }
        return entityNode(task, [task.status, task.effort].filter(Boolean).join(' · '));
      });
      nodes.push(waveNode);
    });

    return nodes;
  }
}

export class BacklogProvider extends TreeProviderBase {
  protected roots(data: ProjectData): ShipyardNode[] {
    if (data.backlog.length === 0) {
      return [info('Backlog is empty', 'inbox')];
    }
    const featuresById = new Map<string, Feature>(data.features.map((f) => [f.id, f]));
    return data.backlog.map((entry) => {
      const feature = featuresById.get(entry.id);
      if (!feature) {
        const node = new ShipyardNode(entry.id);
        node.description = `#${entry.rank} · (missing feature file)`;
        node.iconPath = new vscode.ThemeIcon('question');
        return node;
      }
      const node = entityNode(
        feature,
        `#${entry.rank} · ${feature.storyPoints}pts · RICE ${feature.riceScore}`,
      );
      return node;
    });
  }
}

export class SpecProvider extends TreeProviderBase {
  protected roots(data: ProjectData): ShipyardNode[] {
    const roots: ShipyardNode[] = [];
    const grouped = new Set<string>();

    for (const epic of data.epics) {
      const children = data.features.filter((f) => f.epic === epic.id);
      children.forEach((f) => grouped.add(f.id));
      const node = new ShipyardNode(`${epic.id}  ${epic.title}`, Collapsed);
      const done = children.filter((f) => ['done', 'released', 'deployed'].includes(f.status)).length;
      node.description = `${done}/${children.length} features`;
      node.iconPath = new vscode.ThemeIcon('milestone');
      node.command = openCommand(epic.filePath);
      node.children = children.map((f) =>
        entityNode(f, `${f.storyPoints}pts · ${f.status}`),
      );
      roots.push(node);
    }

    const ungrouped = data.features.filter((f) => !grouped.has(f.id));
    if (ungrouped.length > 0) {
      const node = new ShipyardNode('Ungrouped features', Collapsed);
      node.iconPath = new vscode.ThemeIcon('folder');
      node.children = ungrouped.map((f) => entityNode(f, `${f.storyPoints}pts · ${f.status}`));
      roots.push(node);
    }

    if (data.ideas.length > 0) {
      const node = new ShipyardNode(`Ideas (${data.ideas.length})`, Collapsed);
      node.iconPath = new vscode.ThemeIcon('lightbulb');
      node.children = data.ideas.map((idea) => entityNode(idea));
      roots.push(node);
    }

    if (roots.length === 0) {
      return [info('No epics, features, or ideas yet', 'book')];
    }
    return roots;
  }
}

export class BugsProvider extends TreeProviderBase {
  protected roots(data: ProjectData): ShipyardNode[] {
    if (data.bugs.length === 0) {
      return [info('No bugs filed', 'check-all')];
    }
    return data.bugs.map((bug) =>
      entityNode(bug, [bug.severity, bug.status].filter(Boolean).join(' · ')),
    );
  }
}
