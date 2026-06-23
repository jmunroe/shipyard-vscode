// Typed view of Shipyard's on-disk data model.
// Mirrors the frontmatter schemas defined by the Shipyard plugin templates
// (spec/features, spec/epics, spec/tasks, spec/bugs, spec/ideas, sprints, backlog).

export interface BaseEntity {
  id: string;
  title: string;
  status: string;
  filePath: string;
  /** Raw Markdown body (everything after the frontmatter block), for the viewer. */
  body: string;
  /** Raw parsed frontmatter, for fields not surfaced as typed properties. */
  frontmatter: Record<string, unknown>;
}

export interface Feature extends BaseEntity {
  epic?: string;
  storyPoints: number;
  riceScore: number;
  tasks: string[];
}

export interface Task extends BaseEntity {
  feature?: string;
  effort?: string;
  kind?: string;
}

export interface Epic extends BaseEntity {}

export interface Bug extends BaseEntity {
  severity?: string;
}

export interface Idea extends BaseEntity {}

export interface Sprint {
  id: string;
  goal: string;
  status: string;
  filePath: string;
  /** Raw Markdown body (everything after the frontmatter block), for the viewer. */
  body: string;
  /** Each wave is an ordered list of task IDs. */
  waves: string[][];
  frontmatter: Record<string, unknown>;
}

export interface BacklogEntry {
  rank: number;
  id: string;
}

export interface ProjectData {
  projectName: string;
  features: Feature[];
  tasks: Task[];
  epics: Epic[];
  bugs: Bug[];
  ideas: Idea[];
  sprint?: Sprint;
  backlog: BacklogEntry[];
}
