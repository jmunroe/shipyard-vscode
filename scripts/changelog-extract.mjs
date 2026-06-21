// Print the CHANGELOG.md section body for a given version, used by the release
// workflow to populate GitHub Release notes. Fails loudly (non-zero exit) if the
// version has no section — better to block the release than ship empty notes.
//
//   node scripts/changelog-extract.mjs 0.2.1
import { readFileSync } from 'node:fs';

const version = process.argv[2];
if (!version) {
  console.error('usage: changelog-extract.mjs <version>');
  process.exit(1);
}

const lines = readFileSync('CHANGELOG.md', 'utf8').split('\n');
const header = /^## \[([^\]]+)\]/;

const start = lines.findIndex((line) => {
  const m = line.match(header);
  return m && m[1] === version;
});
if (start === -1) {
  console.error(`No CHANGELOG.md section found for version ${version}`);
  process.exit(1);
}

let end = lines.length;
for (let i = start + 1; i < lines.length; i++) {
  if (header.test(lines[i])) {
    end = i;
    break;
  }
}

const body = lines.slice(start + 1, end).join('\n').trim();
if (!body) {
  console.error(`CHANGELOG.md section for version ${version} is empty`);
  process.exit(1);
}
console.log(body);
