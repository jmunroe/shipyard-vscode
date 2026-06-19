// Standalone smoke check: load a real .shipyard dir and print a summary.
// Not part of the extension bundle; run via esbuild + node (see command below).
import { loadProject } from '../src/shipyard/repository';

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
}

main(dir);
