// Pure string builder: DashboardModel -> the HTML assigned to
// `panel.webview.html`. No vscode import, no DOM — covered by the same headless
// smoke harness as the model. All colors come from `var(--vscode-*)` so the
// dashboard adapts to the active theme; all dynamic text is routed through
// `escapeHtml` (CSP does not stop a stray `<`/`&` from breaking markup).

import { DashboardModel, EpicRollup, StatusBreakdown, WaveProgress } from './model';

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
</style>`;

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta http-equiv="Content-Security-Policy"
        content="default-src 'none'; style-src 'unsafe-inline'; img-src data:;" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Shipyard Dashboard</title>
  ${style}
</head>
<body>
  ${overall}
  ${statusSection(model.byStatus)}
  ${epicSection(model.epics)}
  ${waveSection(model.sprintGoal, model.waves)}
  ${counts}
</body>
</html>`;
}
