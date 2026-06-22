// Pure string builder: DashboardModel -> the HTML assigned to
// `panel.webview.html`. No vscode import, no DOM — covered by the same headless
// smoke harness as the model. All colors come from `var(--vscode-*)` so the
// dashboard adapts to the active theme; all dynamic text is routed through
// `escapeHtml` (CSP does not stop a stray `<`/`&` from breaking markup).

import { ProjectData } from '../shipyard/model';
import {
  computeDashboardModel,
  DashboardModel,
  EpicRollup,
  StatusBreakdown,
  VelocityTrends,
  WeekBucket,
  WaveProgress,
} from './model';

/** Shared document head: charset, strict CSP, viewport, title, and styles. */
function documentHead(style: string): string {
  return `<head>
  <meta charset="UTF-8" />
  <meta http-equiv="Content-Security-Policy"
        content="default-src 'none'; style-src 'unsafe-inline'; img-src data:;" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Shipyard Dashboard</title>
  ${style}
</head>`;
}

/** Escape the five HTML-significant characters in dynamic text. */
export function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

/** A themed progress bar: a div track with an inline-width fill + ARIA role. */
function progressBar(pct: number, label: string): string {
  return `<div class="bar" role="progressbar" aria-valuenow="${pct}" aria-valuemin="0" aria-valuemax="100" aria-label="${escapeHtml(label)}">
  <div class="bar-fill" style="width: ${pct}%"></div>
</div>`;
}

const STATUS_ROWS: Array<{ key: keyof StatusBreakdown; label: string }> = [
  { key: 'proposed', label: 'Proposed' },
  { key: 'approved', label: 'Approved' },
  { key: 'inProgress', label: 'In progress' },
  { key: 'done', label: 'Done' },
  { key: 'deployed', label: 'Deployed' },
  { key: 'released', label: 'Released' },
  { key: 'cancelled', label: 'Cancelled' },
];

function statusSection(b: StatusBreakdown): string {
  const rows = STATUS_ROWS.map(
    ({ key, label }) => `<li><span class="status-label">${label}</span><span class="status-count">${b[key]}</span></li>`,
  ).join('\n');
  return `<section>
  <h2>Features by status</h2>
  <ul class="status-list">
${rows}
  </ul>
</section>`;
}

function epicSection(epics: EpicRollup[]): string {
  if (epics.length === 0) {
    return '<section><h2>Epics</h2><p class="muted">No epics.</p></section>';
  }
  const items = epics
    .map(
      (e) => `<li>
  <div class="epic-head">
    <span class="epic-title">${escapeHtml(e.title)}</span>
    <span class="epic-pts">${e.pointsDone}/${e.pointsTotal} pts · ${e.pct}%</span>
  </div>
  ${progressBar(e.pct, `${e.title}: ${e.pct}% complete`)}
</li>`,
    )
    .join('\n');
  return `<section>
  <h2>Epics</h2>
  <ul class="epic-list">
${items}
  </ul>
</section>`;
}

function waveSection(goal: string, waves: WaveProgress[]): string {
  const goalHtml = goal ? `<p class="goal">${escapeHtml(goal)}</p>` : '<p class="muted">No active sprint.</p>';
  const waveItems =
    waves.length === 0
      ? ''
      : `<ul class="wave-list">
${waves
  .map(
    (w) => `<li><span class="wave-label">Wave ${w.index}</span><span class="wave-count">${w.done}/${w.total} tasks</span></li>`,
  )
  .join('\n')}
  </ul>`;
  return `<section>
  <h2>Sprint</h2>
  ${goalHtml}
  ${waveItems}
</section>`;
}

/** Short, human-readable week label "Www" from an ISO "YYYY-Www" key. */
function weekLabel(weekKey: string): string {
  const dash = weekKey.indexOf('-');
  return dash >= 0 ? weekKey.slice(dash + 1) : weekKey;
}

/**
 * Inline SVG bar chart over weekly buckets. `value` picks points or items;
 * heights scale to the series max. Static markup only — no script. All text is
 * escaped (week keys are template-generated but escaped defensively).
 */
function weeklyBars(weeks: WeekBucket[], value: (w: WeekBucket) => number, title: string): string {
  const w = 28; // px per bar slot
  const gap = 8;
  const h = 80; // chart height
  const max = Math.max(1, ...weeks.map(value));
  const width = weeks.length * w + (weeks.length - 1) * gap;
  const bars = weeks
    .map((bucket, i) => {
      const v = value(bucket);
      const barH = Math.round((v / max) * (h - 18));
      const x = i * (w + gap);
      const y = h - barH - 14;
      const lbl = escapeHtml(weekLabel(bucket.weekKey));
      return `<rect class="velo-bar" x="${x}" y="${y}" width="${w}" height="${barH}" rx="2"><title>${lbl}: ${v}</title></rect>
    <text class="velo-val" x="${x + w / 2}" y="${y - 2}" text-anchor="middle">${v}</text>
    <text class="velo-axis" x="${x + w / 2}" y="${h - 2}" text-anchor="middle">${lbl}</text>`;
    })
    .join('\n    ');
  return `<figure class="velo-chart">
  <figcaption>${escapeHtml(title)}</figcaption>
  <svg viewBox="0 0 ${Math.max(width, 1)} ${h}" width="${Math.max(width, 1)}" height="${h}" role="img" aria-label="${escapeHtml(title)}">
    ${bars}
  </svg>
</figure>`;
}

/** Inline SVG sparkline (polyline) of per-epic completed points over weeks. */
function epicSparkline(weeks: WeekBucket[]): string {
  const w = 120;
  const h = 28;
  const max = Math.max(1, ...weeks.map((b) => b.points));
  const n = weeks.length;
  const step = n > 1 ? w / (n - 1) : 0;
  const pts = weeks
    .map((b, i) => {
      const x = Math.round(i * step);
      const y = Math.round(h - 2 - (b.points / max) * (h - 4));
      return `${x},${y}`;
    })
    .join(' ');
  return `<svg class="velo-spark" viewBox="0 0 ${w} ${h}" width="${w}" height="${h}" role="img" aria-label="completed points trajectory">
    <polyline points="${pts}" fill="none" stroke="var(--vscode-charts-blue, var(--vscode-progressBar-background))" stroke-width="1.5" />
  </svg>`;
}

const VELOCITY_DISCLOSURE = 'approximate (based on last-updated dates)';

function velocitySection(velocity: VelocityTrends): string {
  const disclosure = `<p class="muted velo-note">Trend data is ${escapeHtml(VELOCITY_DISCLOSURE)}.</p>`;

  if (!velocity.enoughHistory) {
    return `<section class="velocity">
  <h2>Velocity trends</h2>
  <p class="muted">Not enough history yet — at least two calendar weeks of completed work are needed to show a trend.</p>
  ${disclosure}
</section>`;
  }

  const pointsChart = weeklyBars(velocity.weeks, (w) => w.points, 'Story points completed per week');
  const itemsChart = weeklyBars(velocity.weeks, (w) => w.items, 'Items completed per week (throughput)');

  const epicRows = velocity.perEpic.length
    ? `<ul class="velo-epic-list">
${velocity.perEpic
  .map(
    (t) => `<li><span class="velo-epic-id">${escapeHtml(t.epicId)}</span>${epicSparkline(t.weeks)}</li>`,
  )
  .join('\n')}
  </ul>`
    : '<p class="muted">No per-epic trajectory.</p>';

  return `<section class="velocity">
  <h2>Velocity trends</h2>
  <div class="velo-charts">
    ${pointsChart}
    ${itemsChart}
  </div>
  <h3 class="velo-sub">Per-epic trajectory</h3>
  ${epicRows}
  ${disclosure}
</section>`;
}

export function renderDashboardHtml(model: DashboardModel): string {
  const overall = `<section class="overall">
  <h1>${escapeHtml(model.projectName)}</h1>
  <p class="big">${model.completionPct}% complete <span class="muted">(${model.pointsDone}/${model.pointsTotal} pts)</span></p>
  ${progressBar(model.completionPct, `Overall completion: ${model.completionPct}%`)}
</section>`;

  const counts = `<section class="counts">
  <h2>Counts</h2>
  <ul class="status-list">
    <li><span class="status-label">Open bugs</span><span class="status-count">${model.openBugs}</span></li>
    <li><span class="status-label">Pending ideas</span><span class="status-count">${model.pendingIdeas}</span></li>
  </ul>
</section>`;

  const style = `<style>
  body { font-family: var(--vscode-font-family); color: var(--vscode-foreground); background: var(--vscode-editor-background); padding: 0 1rem 2rem; line-height: 1.5; }
  h1 { font-size: 1.4rem; margin: 1rem 0 0.25rem; }
  h2 { font-size: 1rem; text-transform: uppercase; letter-spacing: 0.05em; color: var(--vscode-descriptionForeground); border-bottom: 1px solid var(--vscode-panel-border); padding-bottom: 0.25rem; margin-top: 1.75rem; }
  .big { font-size: 1.2rem; font-weight: 600; margin: 0.25rem 0 0.5rem; }
  .muted { color: var(--vscode-descriptionForeground); font-weight: 400; }
  .goal { font-style: italic; }
  ul { list-style: none; padding: 0; margin: 0.5rem 0; }
  .status-list li, .wave-list li { display: flex; justify-content: space-between; padding: 0.15rem 0; border-bottom: 1px solid var(--vscode-panel-border); }
  .status-count, .wave-count, .epic-pts { color: var(--vscode-descriptionForeground); font-variant-numeric: tabular-nums; }
  .epic-list li { margin: 0.75rem 0; }
  .epic-head { display: flex; justify-content: space-between; margin-bottom: 0.25rem; }
  .epic-title { font-weight: 600; }
  .bar { height: 8px; border-radius: 4px; background: var(--vscode-editorWidget-background); border: 1px solid var(--vscode-panel-border); overflow: hidden; }
  .bar-fill { height: 100%; background: var(--vscode-progressBar-background); }
  h3.velo-sub { font-size: 0.85rem; text-transform: uppercase; letter-spacing: 0.05em; color: var(--vscode-descriptionForeground); margin: 1rem 0 0.25rem; }
  .velo-charts { display: flex; flex-wrap: wrap; gap: 1.5rem; margin-top: 0.5rem; }
  .velo-chart { margin: 0; }
  .velo-chart figcaption { font-size: 0.8rem; color: var(--vscode-descriptionForeground); margin-bottom: 0.25rem; }
  .velo-bar { fill: var(--vscode-progressBar-background); }
  .velo-val, .velo-axis { fill: var(--vscode-descriptionForeground); font-size: 9px; font-family: var(--vscode-font-family); }
  .velo-epic-list li { display: flex; align-items: center; gap: 0.75rem; padding: 0.15rem 0; }
  .velo-epic-id { font-variant-numeric: tabular-nums; min-width: 3rem; }
  .velo-note { font-size: 0.8rem; font-style: italic; margin-top: 0.5rem; }
</style>`;

  return `<!DOCTYPE html>
<html lang="en">
${documentHead(style)}
<body>
  ${overall}
  ${statusSection(model.byStatus)}
  ${epicSection(model.epics)}
  ${velocitySection(model.velocity)}
  ${waveSection(model.sprintGoal, model.waves)}
  ${counts}
</body>
</html>`;
}

/** True when there is no project to show (absent or wholly empty snapshot). */
function isEmpty(data: ProjectData | undefined): boolean {
  if (!data) {
    return true;
  }
  return (
    data.features.length === 0 &&
    data.epics.length === 0 &&
    data.tasks.length === 0 &&
    data.bugs.length === 0 &&
    data.ideas.length === 0 &&
    !data.sprint
  );
}

/** The friendly empty state shown when no `.shipyard` project is present. */
export function renderEmptyState(): string {
  const style = `<style>
  body { font-family: var(--vscode-font-family); color: var(--vscode-foreground); background: var(--vscode-editor-background); padding: 2rem 1rem; line-height: 1.5; }
  h1 { font-size: 1.3rem; }
  p { color: var(--vscode-descriptionForeground); }
</style>`;
  return `<!DOCTYPE html>
<html lang="en">
${documentHead(style)}
<body>
  <h1>No Shipyard project</h1>
  <p>No <code>.shipyard</code> folder was found in this workspace. The dashboard will populate once a Shipyard project is present.</p>
</body>
</html>`;
}

/**
 * Top-level, vscode-free entry point: render the dashboard from a `ProjectData`
 * snapshot, or the empty state when the snapshot is absent/empty. The panel
 * (T009) assigns the result to `panel.webview.html`.
 */
export function renderDashboard(data: ProjectData | undefined): string {
  if (isEmpty(data)) {
    return renderEmptyState();
  }
  return renderDashboardHtml(computeDashboardModel(data as ProjectData));
}
