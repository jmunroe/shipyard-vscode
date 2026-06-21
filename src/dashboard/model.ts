// Pure rollup core for the dashboard webview.
//
// `computeDashboardModel` derives everything the dashboard renders from the
// `ProjectData` snapshot the store already holds — no vscode imports, no DOM,
// no I/O. Mirrors the rollup math in the plugin's `skills/ship-status/SKILL.md`
// (see F003 Technical Notes, "Rollup math"). Headless-testable: the smoke
// harness asserts its invariants.

import { ProjectData } from '../shipyard/model';

/** Feature statuses that count as "shipped" for completion + epic rollups. */
const DONE_FEATURE_STATUSES = new Set(['done', 'deployed', 'released']);
/** Bug statuses that are no longer open. */
const CLOSED_BUG_STATUSES = new Set([
  'resolved',
  'closed',
  'fixed',
  'done',
  'wontfix',
  'duplicate',
]);
/**
 * Idea statuses that are no longer pending. Shipyard's idea lifecycle is just
 * `proposed` (the template default) → `graduated` (promoted to a feature, with a
 * `graduated_to: FNNN` pointer). Shipyard's own listings hide graduated ideas.
 */
const RESOLVED_IDEA_STATUSES = new Set(['graduated']);

export interface StatusBreakdown {
  proposed: number;
  approved: number;
  inProgress: number;
  done: number;
  deployed: number;
  released: number;
  cancelled: number;
}

export interface EpicRollup {
  id: string;
  title: string;
  pointsDone: number;
  pointsTotal: number;
  /** 0–100, guarded against divide-by-zero (0 total → 0). */
  pct: number;
}

export interface WaveProgress {
  /** 1-based wave number. */
  index: number;
  done: number;
  total: number;
}

export interface DashboardModel {
  projectName: string;
  /** Overall completion 0–100: done points / total points (0 total → 0). */
  completionPct: number;
  pointsDone: number;
  pointsTotal: number;
  byStatus: StatusBreakdown;
  epics: EpicRollup[];
  sprintId?: string;
  sprintGoal: string;
  waves: WaveProgress[];
  openBugs: number;
  pendingIdeas: number;
}

/** Integer percentage of part/total, guarded against divide-by-zero. */
function pct(part: number, total: number): number {
  return total > 0 ? Math.round((part / total) * 100) : 0;
}

export function computeDashboardModel(data: ProjectData): DashboardModel {
  const byStatus: StatusBreakdown = {
    proposed: 0,
    approved: 0,
    inProgress: 0,
    done: 0,
    deployed: 0,
    released: 0,
    cancelled: 0,
  };

  let pointsDone = 0;
  let pointsTotal = 0;
  for (const f of data.features) {
    pointsTotal += f.storyPoints;
    if (DONE_FEATURE_STATUSES.has(f.status)) {
      pointsDone += f.storyPoints;
    }
    switch (f.status) {
      case 'proposed':
        byStatus.proposed++;
        break;
      case 'approved':
        byStatus.approved++;
        break;
      case 'in-progress':
        byStatus.inProgress++;
        break;
      case 'done':
        byStatus.done++;
        break;
      case 'deployed':
        byStatus.deployed++;
        break;
      case 'released':
        byStatus.released++;
        break;
      case 'cancelled':
        byStatus.cancelled++;
        break;
    }
  }

  const epics: EpicRollup[] = data.epics.map((ep) => {
    const kids = data.features.filter((f) => f.epic === ep.id);
    const total = kids.reduce((sum, f) => sum + f.storyPoints, 0);
    const done = kids
      .filter((f) => DONE_FEATURE_STATUSES.has(f.status))
      .reduce((sum, f) => sum + f.storyPoints, 0);
    return { id: ep.id, title: ep.title, pointsDone: done, pointsTotal: total, pct: pct(done, total) };
  });

  const taskStatus = new Map(data.tasks.map((t) => [t.id, t.status]));
  const waves: WaveProgress[] = (data.sprint?.waves ?? []).map((ids, i) => ({
    index: i + 1,
    total: ids.length,
    done: ids.filter((id) => taskStatus.get(id) === 'done').length,
  }));

  const openBugs = data.bugs.filter((b) => !CLOSED_BUG_STATUSES.has(b.status)).length;
  const pendingIdeas = data.ideas.filter((i) => !RESOLVED_IDEA_STATUSES.has(i.status)).length;

  return {
    projectName: data.projectName,
    completionPct: pct(pointsDone, pointsTotal),
    pointsDone,
    pointsTotal,
    byStatus,
    epics,
    sprintId: data.sprint?.id,
    sprintGoal: data.sprint?.goal ?? '',
    waves,
    openBugs,
    pendingIdeas,
  };
}
