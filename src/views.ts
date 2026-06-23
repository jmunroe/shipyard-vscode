import * as vscode from 'vscode';
import { ShipyardStore } from './store';
import { BaseEntity, Feature, ProjectData, Task } from './shipyard/model';

const Collapsed = vscode.TreeItemCollapsibleState.Collapsed;
const None = vscode.TreeItemCollapsibleState.None;

/** A node in any Shipyard tree. Children are precomputed when the tree builds. */
export class ShipyardNode extends vscode.TreeItem {
  children?: ShipyardNode[];
  /** Raw entity id (e.g. 'F003', 'T011'), so context commands resolve <id> without parsing the label. */
  itemId?: string;

  constructor(label: string, collapsibleState = None) {
    super(label, collapsibleState);
  }
}

/** Tree-node types that carry a per-type contextValue gating context menus. */
type EntityKind = 'feature' | 'idea' | 'epic' | 'bug' | 'task';

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

/**
 * Entity-node click target: open the item by id via `shipyard.openItem`, which
 * honours the `shipyard.openBehavior` setting (rendered viewer vs raw editor).
 * The id (not a file path) is passed so the same command id is reused by the
 * viewer's cross-ref `command:` URIs (T020).
 */
function openItemCommand(id: string): vscode.Command {
  return { command: 'shipyard.openItem', title: 'Open', arguments: [id] };
}

function info(message: string, icon = 'info'): ShipyardNode {
  const node = new ShipyardNode(message);
  node.iconPath = new vscode.ThemeIcon(icon);
  return node;
}

/** Build a leaf node for any entity that has an id, title, status and file. */
function entityNode(entity: BaseEntity, kind: EntityKind, description?: string): ShipyardNode {
  const node = new ShipyardNode(`${entity.id}  ${entity.title}`);
  node.description = description ?? entity.status;
  node.tooltip = `${entity.id} — ${entity.title}\nstatus: ${entity.status}`;
  node.iconPath = statusIcon(entity.status);
  node.command = openItemCommand(entity.id);
  node.contextValue = kind;
  node.itemId = entity.id;
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
    goal.command = openItemCommand(sprint.id);
    goal.itemId = sprint.id;

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
        return entityNode(task, 'task', [task.status, task.effort].filter(Boolean).join(' · '));
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
        'feature',
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
      node.command = openItemCommand(epic.id);
      node.contextValue = 'epic';
      node.itemId = epic.id;
      node.children = children.map((f) =>
        entityNode(f, 'feature', `${f.storyPoints}pts · ${f.status}`),
      );
      roots.push(node);
    }

    const ungrouped = data.features.filter((f) => !grouped.has(f.id));
    if (ungrouped.length > 0) {
      const node = new ShipyardNode('Ungrouped features', Collapsed);
      node.iconPath = new vscode.ThemeIcon('folder');
      node.children = ungrouped.map((f) => entityNode(f, 'feature', `${f.storyPoints}pts · ${f.status}`));
      roots.push(node);
    }

    // Graduated ideas were promoted to features and are kept on disk only as a
    // historical record; Shipyard's own listings hide them, so we do too.
    const activeIdeas = data.ideas.filter((idea) => idea.status !== 'graduated');
    if (activeIdeas.length > 0) {
      const node = new ShipyardNode(`Ideas (${activeIdeas.length})`, Collapsed);
      node.iconPath = new vscode.ThemeIcon('lightbulb');
      node.children = activeIdeas.map((idea) => entityNode(idea, 'idea'));
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
      entityNode(bug, 'bug', [bug.severity, bug.status].filter(Boolean).join(' · ')),
    );
  }
}
