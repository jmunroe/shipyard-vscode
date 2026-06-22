// Standalone smoke check: load a real .shipyard dir and print a summary.
// Not part of the extension bundle; run via esbuild + node (see command below).
import { loadProject } from '../src/shipyard/repository';
import { computeDashboardModel, computeVelocityTrends, DashboardModel } from '../src/dashboard/model';
import { renderDashboardHtml, renderDashboard } from '../src/dashboard/render';
import { ProjectData } from '../src/shipyard/model';

function assert(cond: boolean, msg: string): void {
  if (!cond) {
    throw new Error(`smoke assertion failed: ${msg}`);
  }
}

const dir = process.argv[2];
if (!dir) {
  console.error('usage: smoke <path-to-.shipyard>');
  process.exit(1);
}

async function main(dir: string): Promise<void> {
const data = await loadProject(dir);
console.log('project:', data.projectName);
console.log('features:', data.features.length);
console.log('epics:', data.epics.length);
console.log('ideas:', data.ideas.length);
console.log('bugs:', data.bugs.length);
console.log('tasks:', data.tasks.length);
console.log('backlog entries:', data.backlog.length);
console.log('sprint:', data.sprint ? `${data.sprint.id} (${data.sprint.status}), waves=${data.sprint.waves.length}` : 'none');
console.log('\nbacklog (rank → id → title):');
const byId = new Map(data.features.map((f) => [f.id, f]));
for (const e of data.backlog) {
  const f = byId.get(e.id);
  console.log(`  #${e.rank} ${e.id} — ${f ? f.title : '(missing)'} [${f?.storyPoints ?? '?'}pts, RICE ${f?.riceScore ?? '?'}, ${f?.status ?? '?'}]`);
}
console.log('\nepics:');
for (const ep of data.epics) {
  const kids = data.features.filter((f) => f.epic === ep.id);
  console.log(`  ${ep.id} ${ep.title} — ${kids.length} features`);
}

// --- T007: dashboard rollup model ---
const dash = computeDashboardModel(data);
console.log(
  `\ndashboard: ${dash.completionPct}% done, ${dash.epics.length} epics, ${dash.openBugs} bugs, ${dash.pendingIdeas} ideas`,
);
assert(dash.completionPct >= 0 && dash.completionPct <= 100, `completionPct in [0,100], got ${dash.completionPct}`);
for (const ep of dash.epics) {
  assert(ep.pct >= 0 && ep.pct <= 100, `epic ${ep.id} pct in [0,100], got ${ep.pct}`);
  assert(ep.pointsDone >= 0 && ep.pointsTotal >= 0, `epic ${ep.id} non-negative points`);
}
assert(dash.openBugs >= 0, `openBugs non-negative, got ${dash.openBugs}`);
assert(dash.pendingIdeas >= 0, `pendingIdeas non-negative, got ${dash.pendingIdeas}`);
assert(dash.pointsDone >= 0 && dash.pointsTotal >= 0, 'overall points non-negative');
assert(dash.pointsDone <= dash.pointsTotal, 'pointsDone <= pointsTotal');
for (const w of dash.waves) {
  assert(w.done >= 0 && w.done <= w.total, `wave ${w.index} done in [0,total]`);
}

// --- T008: dashboard HTML render (escaping, theming, accessibility) ---
const hostile: DashboardModel = {
  projectName: '<script>alert(1)</script>',
  completionPct: 50,
  pointsDone: 5,
  pointsTotal: 10,
  byStatus: { proposed: 1, approved: 0, inProgress: 1, done: 1, deployed: 0, released: 0, cancelled: 0 },
  epics: [{ id: 'E001', title: '<script>alert(1)</script>', pointsDone: 5, pointsTotal: 10, pct: 50 }],
  sprintId: 'sprint-x',
  sprintGoal: 'Ship <b>everything</b> & more',
  waves: [{ index: 1, done: 1, total: 2 }],
  openBugs: 0,
  pendingIdeas: 3,
  velocity: { weeks: [], perEpic: [], enoughHistory: false, approximate: true },
};
const html = renderDashboardHtml(hostile);
assert(!html.includes('<script>'), 'rendered HTML must not contain a literal <script>');
assert(html.includes('var(--vscode-'), 'rendered HTML must use var(--vscode-*) theming');
assert(html.includes('role="progressbar"'), 'rendered HTML must mark progress bars with role="progressbar"');
assert(html.includes('&lt;script&gt;'), 'hostile titles must be HTML-escaped');
assert(html.includes('&amp;'), 'ampersands in dynamic text must be HTML-escaped');
console.log('dashboard-render: ok');

// --- T009: empty / absent project renders a friendly state, no throw ---
const emptyData: ProjectData = {
  projectName: 'Shipyard',
  features: [],
  tasks: [],
  epics: [],
  bugs: [],
  ideas: [],
  sprint: undefined,
  backlog: [],
};
for (const sample of [undefined, emptyData]) {
  const out = renderDashboard(sample);
  assert(out.includes('No Shipyard project'), 'empty state must show a friendly "No Shipyard project" message');
}
console.log('dashboard-empty: ok');

// --- T015: velocity trends model (weekly ISO buckets + per-epic trajectory) ---
// Single-week fixture: two done features whose `updated` dates land in the same
// ISO week → enoughHistory must be false (need ≥2 distinct weeks).
const oneWeekData: ProjectData = {
  projectName: 'Velo',
  features: [
    {
      id: 'F100', title: 'A', status: 'done', epic: 'E001', storyPoints: 3, riceScore: 0,
      tasks: [], filePath: 'F100.md', frontmatter: { updated: '2026-06-22' },
    },
    {
      id: 'F101', title: 'B', status: 'released', epic: '', storyPoints: 2, riceScore: 0,
      tasks: [], filePath: 'F101.md', frontmatter: { updated: new Date(Date.UTC(2026, 5, 24)) },
    },
    {
      // proposed (not done) → must be excluded from velocity entirely.
      id: 'F102', title: 'C', status: 'proposed', epic: 'E001', storyPoints: 8, riceScore: 0,
      tasks: [], filePath: 'F102.md', frontmatter: { updated: '2026-01-01' },
    },
  ],
  tasks: [], epics: [], bugs: [], ideas: [], sprint: undefined, backlog: [],
};
const velo = computeVelocityTrends(oneWeekData);
assert(velo.approximate === true, 'velocity is flagged approximate');
assert(velo.enoughHistory === false, 'single-week completions → enoughHistory false');
assert(velo.weeks.length >= 1, 'single-week fixture yields at least one bucket');
for (let i = 0; i < velo.weeks.length; i++) {
  const w = velo.weeks[i];
  assert(/^\d{4}-W\d{2}$/.test(w.weekKey), `weekKey is YYYY-Www, got ${w.weekKey}`);
  assert(w.points >= 0 && w.items >= 0, `week ${w.weekKey} non-negative points/items`);
  if (i > 0) {
    assert(velo.weeks[i - 1].weekKey <= w.weekKey, 'week buckets sorted ascending by weekKey');
  }
}
// proposed feature's 8 points must not appear; only done(3)+released(2)=5.
const totalPts = velo.weeks.reduce((s, w) => s + w.points, 0);
assert(totalPts === 5, `only done/released points counted, expected 5 got ${totalPts}`);
// empty-epic feature (F101) must not synthesize a phantom "" epic.
assert(velo.perEpic.every((e) => e.epicId !== ''), 'no phantom empty-epic trajectory');

// Live data: trends recompute on the real .shipyard and exposed on the model.
const dashWithVelo = computeDashboardModel(data);
assert(dashWithVelo.velocity.approximate === true, 'dashboard exposes approximate velocity');
for (const w of dashWithVelo.velocity.weeks) {
  assert(w.points >= 0 && w.items >= 0, `live week ${w.weekKey} non-negative`);
}
console.log(
  `velocity-trends: ok (weeks=${velo.weeks.length}, enoughHistory=${velo.enoughHistory}; live weeks=${dashWithVelo.velocity.weeks.length})`,
);

// --- T016: velocity trends SVG section render ---
// ≥2-week fixture: completions land in two distinct ISO weeks → a chart renders
// (inline <svg>) plus the unconditional approximate-data disclosure label.
const twoWeekData: ProjectData = {
  projectName: 'Velo',
  features: [
    {
      id: 'F200', title: 'A', status: 'done', epic: 'E001', storyPoints: 3, riceScore: 0,
      tasks: [], filePath: 'F200.md', frontmatter: { updated: new Date(Date.UTC(2026, 5, 15)) },
    },
    {
      id: 'F201', title: 'B', status: 'released', epic: 'E001', storyPoints: 5, riceScore: 0,
      tasks: [], filePath: 'F201.md', frontmatter: { updated: new Date(Date.UTC(2026, 5, 22)) },
    },
  ],
  tasks: [], epics: [{ id: 'E001', title: 'Epic One', status: 'in-progress', filePath: 'E001.md', frontmatter: {} }],
  bugs: [], ideas: [], sprint: undefined, backlog: [],
};
const twoWeekModel = computeDashboardModel(twoWeekData);
assert(twoWeekModel.velocity.enoughHistory === true, 'two-week fixture has enoughHistory');
const twoWeekHtml = renderDashboardHtml(twoWeekModel);
assert(twoWeekHtml.includes('<svg'), 'velocity section renders an inline <svg> when there is enough history');
assert(
  twoWeekHtml.includes('approximate (based on last-updated dates)'),
  'velocity section shows the approximate-data disclosure label',
);
assert(!twoWeekHtml.includes('<script>'), 'velocity render must not contain a raw <script> (CSP / enableScripts:false)');

// Single-week fixture: only one ISO week of completions → "not enough history"
// message instead of a chart, but the disclosure label is still present.
const singleWeekModel = computeDashboardModel(oneWeekData);
assert(singleWeekModel.velocity.enoughHistory === false, 'single-week fixture has enoughHistory false');
const singleWeekHtml = renderDashboardHtml(singleWeekModel);
assert(
  /not enough history/i.test(singleWeekHtml),
  'single-week fixture renders a "not enough history" message',
);
assert(!singleWeekHtml.includes('<svg'), 'no chart <svg> when there is not enough history');
assert(
  singleWeekHtml.includes('approximate (based on last-updated dates)'),
  'disclosure label is unconditional, present even without enough history',
);
assert(!singleWeekHtml.includes('<script>'), 'single-week velocity render must not contain a raw <script>');
console.log('velocity-render: ok');
}

main(dir);
