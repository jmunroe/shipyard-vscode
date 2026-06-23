import * as fs from 'fs/promises';
import * as path from 'path';
import matter from 'gray-matter';
import {
  BacklogEntry,
  Bug,
  Epic,
  Feature,
  Idea,
  ProjectData,
  Sprint,
  Task,
} from './model';

interface Parsed {
  data: Record<string, unknown>;
  content: string;
}

async function listMarkdown(dir: string): Promise<string[]> {
  try {
    const entries = await fs.readdir(dir);
    return entries
      .filter((e) => e.endsWith('.md') && !e.startsWith('.'))
      .map((e) => path.join(dir, e));
  } catch {
    return []; // directory may not exist yet
  }
}

async function parseFile(file: string): Promise<Parsed | undefined> {
  try {
    const raw = await fs.readFile(file, 'utf8');
    const { data, content } = matter(raw);
    return { data: data as Record<string, unknown>, content };
  } catch {
    return undefined;
  }
}

function num(value: unknown, fallback = 0): number {
  const n = typeof value === 'string' ? Number(value) : (value as number);
  return Number.isFinite(n) ? (n as number) : fallback;
}

function str(value: unknown): string | undefined {
  if (typeof value === 'string' && value.trim()) {
    return value.trim();
  }
  return undefined;
}

/** Title precedence: frontmatter.title → first real H1 → filename. */
function deriveTitle(data: Record<string, unknown>, content: string, file: string): string {
  const fm = str(data.title);
  if (fm) {
    return fm;
  }
  const h1 = content.match(/^#\s+(.+)$/m);
  if (h1 && !h1[1].includes('[Title]')) {
    return h1[1].trim();
  }
  return path.basename(file, '.md');
}

async function loadEntities<T>(
  dir: string,
  map: (p: Parsed, file: string) => T,
): Promise<T[]> {
  const files = await listMarkdown(dir);
  const out: T[] = [];
  for (const file of files) {
    const parsed = await parseFile(file);
    if (parsed) {
      out.push(map(parsed, file));
    }
  }
  return out;
}

function parseBacklog(content: string): BacklogEntry[] {
  // Rows look like: | 1 | F020 |
  const entries: BacklogEntry[] = [];
  for (const line of content.split(/\r?\n/)) {
    const m = line.match(/^\|\s*(\d+)\s*\|\s*([A-Za-z]+\d+[a-z]?)\s*\|/);
    if (m) {
      entries.push({ rank: Number(m[1]), id: m[2] });
    }
  }
  return entries.sort((a, b) => a.rank - b.rank);
}

function parseWaves(content: string): string[][] {
  const waves: string[][] = [];
  let current: string[] | null = null;
  for (const line of content.split(/\r?\n/)) {
    if (/^###\s+Wave\b/i.test(line)) {
      current = [];
      waves.push(current);
      continue;
    }
    // A non-wave top-level (##) heading ends the Waves section.
    if (/^##\s/.test(line) && !/wave/i.test(line)) {
      current = null;
    }
    if (current) {
      const ids = line.match(/\bT\d+\b/g);
      if (ids) {
        current.push(...ids);
      }
    }
  }
  return waves;
}

async function loadSprint(shipyardDir: string): Promise<Sprint | undefined> {
  const file = path.join(shipyardDir, 'sprints', 'current', 'SPRINT.md');
  const parsed = await parseFile(file);
  if (!parsed) {
    return undefined;
  }
  const { data, content } = parsed;
  return {
    id: str(data.id) ?? 'current',
    goal: str(data.goal) ?? '',
    status: str(data.status) ?? 'unknown',
    filePath: file,
    body: content,
    waves: parseWaves(content),
    frontmatter: data,
  };
}

export async function loadProject(shipyardDir: string): Promise<ProjectData> {
  const spec = path.join(shipyardDir, 'spec');

  const [features, tasks, epics, bugs, ideas, sprint, backlogParsed, config] =
    await Promise.all([
      loadEntities<Feature>(path.join(spec, 'features'), ({ data, content }, file) => ({
        id: str(data.id) ?? path.basename(file, '.md'),
        title: deriveTitle(data, content, file),
        status: str(data.status) ?? 'proposed',
        epic: str(data.epic),
        storyPoints: num(data.story_points),
        riceScore: num(data.rice_score),
        tasks: Array.isArray(data.tasks) ? (data.tasks as string[]) : [],
        filePath: file,
        body: content,
        frontmatter: data,
      })),
      loadEntities<Task>(path.join(spec, 'tasks'), ({ data, content }, file) => ({
        id: str(data.id) ?? path.basename(file, '.md'),
        title: deriveTitle(data, content, file),
        status: str(data.status) ?? 'pending',
        feature: str(data.feature),
        effort: str(data.effort),
        kind: str(data.kind),
        filePath: file,
        body: content,
        frontmatter: data,
      })),
      loadEntities<Epic>(path.join(spec, 'epics'), ({ data, content }, file) => ({
        id: str(data.id) ?? path.basename(file, '.md'),
        title: deriveTitle(data, content, file),
        status: str(data.status) ?? 'proposed',
        filePath: file,
        body: content,
        frontmatter: data,
      })),
      loadEntities<Bug>(path.join(spec, 'bugs'), ({ data, content }, file) => ({
        id: str(data.id) ?? path.basename(file, '.md'),
        title: deriveTitle(data, content, file),
        status: str(data.status) ?? 'open',
        severity: str(data.severity),
        filePath: file,
        body: content,
        frontmatter: data,
      })),
      loadEntities<Idea>(path.join(spec, 'ideas'), ({ data, content }, file) => ({
        id: str(data.id) ?? path.basename(file, '.md'),
        title: deriveTitle(data, content, file),
        status: str(data.status) ?? 'proposed',
        filePath: file,
        body: content,
        frontmatter: data,
      })),
      loadSprint(shipyardDir),
      parseFile(path.join(shipyardDir, 'backlog', 'BACKLOG.md')),
      parseFile(path.join(shipyardDir, 'config.md')),
    ]);

  return {
    projectName: str(config?.data.project_name) ?? 'Shipyard',
    features,
    tasks,
    epics,
    bugs,
    ideas,
    sprint,
    backlog: backlogParsed ? parseBacklog(backlogParsed.content) : [],
  };
}
