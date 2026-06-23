// Pure id→entity resolution for the viewer. No vscode, no IO — shared by the
// panel (src/viewer.ts) and the render module (src/viewer/render.ts), and kept
// import-free of runtime APIs so the render path stays headless-testable.

import { BaseEntity, ProjectData } from '../shipyard/model';

/**
 * Resolve an entity id (e.g. `F003`, `T011`, `E001`, a bug or idea id, or the
 * sprint id) to its `BaseEntity` record in the loaded project, or `undefined`
 * if no such entity exists. The sprint is surfaced as an entity too, so the
 * sprint-goal node opens in the viewer like any other node.
 */
export function findEntity(data: ProjectData | undefined, id: string): BaseEntity | undefined {
  if (!data || !id) {
    return undefined;
  }
  const pools: BaseEntity[][] = [data.features, data.epics, data.tasks, data.bugs, data.ideas];
  for (const pool of pools) {
    const hit = pool.find((e) => e.id === id);
    if (hit) {
      return hit;
    }
  }
  const sprint = data.sprint;
  if (sprint && sprint.id === id) {
    return {
      id: sprint.id,
      title: sprint.goal || sprint.id,
      status: sprint.status,
      filePath: sprint.filePath,
      body: sprint.body,
      frontmatter: sprint.frontmatter,
    };
  }
  return undefined;
}
