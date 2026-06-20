// Standalone smoke check: load a real .shipyard dir and print a summary.
// Not part of the extension bundle; run via esbuild + node (see command below).
import { loadProject } from '../src/shipyard/repository';
import { computeDashboardModel } from '../src/dashboard/model';

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
}

main(dir);
