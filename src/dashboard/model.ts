// Pure rollup core for the dashboard webview.
//
// `computeDashboardModel` derives everything the dashboard renders from the
// `ProjectData` snapshot the store already holds — no vscode imports, no DOM,
// no I/O. Mirrors the rollup math in the plugin's `skills/ship-status/SKILL.md`
// (see F003 Technical Notes, "Rollup math"). Headless-testable: the smoke
// harness asserts its invariants.

import { Feature, ProjectData } from '../shipyard/model';

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

/** Completed work in a single ISO-8601 calendar week, keyed "YYYY-Www". */
export interface WeekBucket {
  /** ISO week key, e.g. "2026-W25". Lexically sortable. */
  weekKey: string;
  /** Story points completed in this week. */
  points: number;
  /** Number of items (features) completed in this week. */
  items: number;
}

/** Per-epic completed-points-per-week trajectory. */
export interface EpicTrajectory {
  epicId: string;
  weeks: WeekBucket[];
}

/**
 * Velocity over time, derived from the `updated` frontmatter of completed
 * features (approximate: last-touched, not the exact done transition).
 * Features only — tasks carry no `updated` in this project.
 */
export interface VelocityTrends {
  weeks: WeekBucket[];
  perEpic: EpicTrajectory[];
  /** true only when ≥2 distinct weeks contain completions. */
  enoughHistory: boolean;
  /** Always true: completion time is the `updated` proxy, not authoritative. */
  approximate: true;
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
  velocity: VelocityTrends;
}

/** Integer percentage of part/total, guarded against divide-by-zero. */
function pct(part: number, total: number): number {
  return total > 0 ? Math.round((part / total) * 100) : 0;
}

/**
 * ISO-8601 week key ("YYYY-Www") for a UTC date. Mon-start; week 1 is the week
 * containing the year's first Thursday. Computed entirely in UTC (no library)
 * to match gray-matter's UTC-midnight Dates and avoid TZ drift across week
 * lines. The ISO year can differ from the calendar year near boundaries (early
 * January can belong to the prior year's W52/W53; late December can roll into
 * the next year's W01).
 */
function isoWeekKey(date: Date): string {
  // Work on a copy normalized to UTC midnight.
  const d = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
  // ISO weekday: Mon=1 … Sun=7.
  const day = d.getUTCDay() || 7;
  // Shift to the Thursday of this week — its calendar year is the ISO year.
  d.setUTCDate(d.getUTCDate() + 4 - day);
  const isoYear = d.getUTCFullYear();
  // First day of the ISO year, then weeks since.
  const yearStart = Date.UTC(isoYear, 0, 1);
  const week = Math.ceil(((d.getTime() - yearStart) / 86400000 + 1) / 7);
  return `${isoYear}-W${String(week).padStart(2, '0')}`;
}

/**
 * Normalize a frontmatter `updated` value (Date | string | unknown) to a valid
 * Date, or undefined when missing/invalid. Bare YAML dates parse to a JS Date;
 * quoted values stay strings.
 */
function parseUpdated(val: unknown): Date | undefined {
  if (val === undefined || val === null) {
    return undefined;
  }
  const d = val instanceof Date ? val : new Date(val as string);
  return Number.isNaN(d.getTime()) ? undefined : d;
}

/** Accumulate completed-feature points/items into ISO-week buckets, sorted ascending. */
function bucketByWeek(features: Feature[]): WeekBucket[] {
  const byWeek = new Map<string, WeekBucket>();
  for (const f of features) {
    if (!DONE_FEATURE_STATUSES.has(f.status)) {
      continue;
    }
    const d = parseUpdated(f.frontmatter.updated);
    if (!d) {
      continue;
    }
    const key = isoWeekKey(d);
    const bucket = byWeek.get(key) ?? { weekKey: key, points: 0, items: 0 };
    bucket.points += f.storyPoints;
    bucket.items += 1;
    byWeek.set(key, bucket);
  }
  return [...byWeek.values()].sort((a, b) => (a.weekKey < b.weekKey ? -1 : a.weekKey > b.weekKey ? 1 : 0));
}

/**
 * Velocity over time from completed features' `updated` dates (approximate).
 * Features only; reuses DONE_FEATURE_STATUSES. Per-epic trajectory excludes
 * features with an empty `epic`. enoughHistory is true only with ≥2 distinct
 * weeks of completions.
 */
export function computeVelocityTrends(data: ProjectData): VelocityTrends {
  const weeks = bucketByWeek(data.features);

  const epicIds = new Set<string>();
  for (const f of data.features) {
    if (f.epic) {
      epicIds.add(f.epic);
    }
  }
  const perEpic: EpicTrajectory[] = [...epicIds]
    .sort()
    .map((epicId) => ({
      epicId,
      weeks: bucketByWeek(data.features.filter((f) => f.epic === epicId)),
    }))
    .filter((t) => t.weeks.length > 0);

  return {
    weeks,
    perEpic,
    enoughHistory: weeks.length >= 2,
    approximate: true,
  };
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
    velocity: computeVelocityTrends(data),
  };
}
