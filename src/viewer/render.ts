// Pure string builder: a BaseEntity -> the HTML assigned to the viewer's
// `panel.webview.html`. No vscode import, no DOM — covered by the same headless
// smoke harness as the dashboard. The hardened `<head>`/CSP and `escapeHtml` are
// reused from the dashboard render module so there is a single CSP shell; the
// Markdown body runs through markdown-it with `html: false` (literal HTML in the
// source is escaped, so a no-script posture holds with the CSP as backstop).

import MarkdownIt from 'markdown-it';
import { BaseEntity, ProjectData } from '../shipyard/model';
import { documentHead, escapeHtml } from '../dashboard/render';

const md = new MarkdownIt({ html: false, linkify: false });

/** Frontmatter fields surfaced as labelled chips, in display order. */
const CHIP_FIELDS: Array<{ key: string; label: string }> = [
  { key: 'story_points', label: 'points' },
  { key: 'effort', label: 'effort' },
  { key: 'kind', label: 'kind' },
  { key: 'complexity', label: 'complexity' },
  { key: 'rice_score', label: 'RICE' },
  { key: 'severity', label: 'severity' },
  { key: 'epic', label: 'epic' },
  { key: 'feature', label: 'feature' },
  { key: 'dependencies', label: 'deps' },
  { key: 'graduated_to', label: 'graduated to' },
  { key: 'capacity', label: 'capacity' },
  { key: 'external_refs', label: 'external' },
];

/** Map a status to a chip colour class, mirroring the tree's status vocabulary. */
function statusClass(status: string): string {
  switch (status.toLowerCase()) {
    case 'done':
    case 'released':
    case 'deployed':
      return 'chip-green';
    case 'in-progress':
      return 'chip-blue';
    case 'blocked':
      return 'chip-red';
    case 'needs-attention':
      return 'chip-yellow';
    case 'cancelled':
    case 'obsolete':
    case 'graduated':
      return 'chip-muted';
    default:
      return '';
  }
}

/** Normalise a frontmatter value to a display string, or undefined to skip. */
function chipValue(value: unknown): string | undefined {
  if (value === null || value === undefined) {
    return undefined;
  }
  if (Array.isArray(value)) {
    const items = value.map((v) => String(v).trim()).filter(Boolean);
    return items.length ? items.join(', ') : undefined;
  }
  if (typeof value === 'object') {
    return undefined;
  }
  const s = String(value).trim();
  return s ? s : undefined;
}

function chip(label: string, value: string, cls = ''): string {
  return `<span class="chip ${cls}"><span class="chip-label">${escapeHtml(label)}</span><span class="chip-value">${escapeHtml(value)}</span></span>`;
}

/** Frontmatter as a row of labelled chips (status first, then curated fields). */
function chips(item: BaseEntity): string {
  const out: string[] = [chip('status', item.status, statusClass(item.status))];
  for (const { key, label } of CHIP_FIELDS) {
    const val = chipValue(item.frontmatter[key]);
    if (val !== undefined) {
      out.push(chip(label, val));
    }
  }
  return `<div class="chips">\n${out.join('\n')}\n</div>`;
}

/** Render the Markdown body to HTML (html:false → raw HTML/scripts are escaped). */
function renderBody(item: BaseEntity): string {
  const src = (item.body || '').trim();
  if (!src) {
    return '<p class="muted">No description.</p>';
  }
  return `<div class="md-body">\n${md.render(src)}\n</div>`;
}

const VIEWER_STYLE = `<style>
  body { font-family: var(--vscode-font-family); color: var(--vscode-foreground); background: var(--vscode-editor-background); padding: 0 1rem 2rem; line-height: 1.5; }
  h1 { font-size: 1.4rem; margin: 1rem 0 0.5rem; }
  h1 .title { font-weight: 400; color: var(--vscode-descriptionForeground); }
  .muted { color: var(--vscode-descriptionForeground); }
  .chips { display: flex; flex-wrap: wrap; gap: 0.4rem; margin: 0.5rem 0 1rem; }
  .chip { display: inline-flex; align-items: baseline; gap: 0.3rem; padding: 0.1rem 0.5rem; border: 1px solid var(--vscode-panel-border); border-radius: 10px; background: var(--vscode-editorWidget-background); font-size: 0.8rem; }
  .chip-label { color: var(--vscode-descriptionForeground); text-transform: uppercase; letter-spacing: 0.04em; font-size: 0.7rem; }
  .chip-value { font-variant-numeric: tabular-nums; }
  .chip a { color: var(--vscode-textLink-foreground); text-decoration: none; }
  .chip a:hover { text-decoration: underline; }
  .chip-dangling { color: var(--vscode-descriptionForeground); font-style: italic; }
  .chip-green .chip-value { color: var(--vscode-charts-green, var(--vscode-foreground)); }
  .chip-blue .chip-value { color: var(--vscode-charts-blue, var(--vscode-foreground)); }
  .chip-red .chip-value { color: var(--vscode-charts-red, var(--vscode-foreground)); }
  .chip-yellow .chip-value { color: var(--vscode-charts-yellow, var(--vscode-foreground)); }
  .chip-muted .chip-value { color: var(--vscode-descriptionForeground); }
  .md-body h1, .md-body h2, .md-body h3 { line-height: 1.3; }
  .md-body h1 { font-size: 1.2rem; }
  .md-body h2 { font-size: 1.05rem; border-bottom: 1px solid var(--vscode-panel-border); padding-bottom: 0.2rem; }
  .md-body code { font-family: var(--vscode-editor-font-family, monospace); background: var(--vscode-textCodeBlock-background); padding: 0.1rem 0.3rem; border-radius: 3px; }
  .md-body pre { background: var(--vscode-textCodeBlock-background); padding: 0.75rem; border-radius: 4px; overflow-x: auto; }
  .md-body pre code { background: none; padding: 0; }
  .md-body a { color: var(--vscode-textLink-foreground); }
  .md-body table { border-collapse: collapse; }
  .md-body th, .md-body td { border: 1px solid var(--vscode-panel-border); padding: 0.25rem 0.5rem; }
  .md-body blockquote { margin: 0.5rem 0; padding-left: 0.75rem; border-left: 3px solid var(--vscode-panel-border); color: var(--vscode-descriptionForeground); }
</style>`;

/** The "this item no longer exists" state (deleted while the viewer was open). */
export function renderMissing(itemId: string): string {
  return `<!DOCTYPE html>
<html lang="en">
${documentHead(VIEWER_STYLE, 'Shipyard Viewer')}
<body>
  <h1 class="muted">${escapeHtml(itemId)}</h1>
  <p class="muted">This item no longer exists.</p>
</body>
</html>`;
}

/**
 * Render an entity to the viewer HTML: frontmatter as labelled chips and the
 * Markdown body rendered to HTML under the dashboard's hardened no-script CSP.
 * `data` is used in T020 for cross-reference link resolution.
 */
export function renderViewer(item: BaseEntity, data: ProjectData | undefined): string {
  void data;
  return `<!DOCTYPE html>
<html lang="en">
${documentHead(VIEWER_STYLE, `Shipyard: ${item.id}`)}
<body>
  <h1>${escapeHtml(item.id)} <span class="title">${escapeHtml(item.title)}</span></h1>
  ${chips(item)}
  ${renderBody(item)}
</body>
</html>`;
}
