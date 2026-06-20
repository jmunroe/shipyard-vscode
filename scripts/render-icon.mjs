// Rasterize media/icon.svg -> media/icon.png at 128x128 for the Marketplace tile.
// Deterministic: same source SVG yields the same-size PNG every run.
// Dev-only (invoked via `npm run icon`); @resvg/resvg-js is a devDependency and
// is never bundled into dist/extension.js or shipped in the .vsix.
import { readFileSync, writeFileSync } from "node:fs";
import { Resvg } from "@resvg/resvg-js";

const SRC = "media/icon.svg";
const OUT = "media/icon.png";

const svg = readFileSync(SRC);
const resvg = new Resvg(svg, { fitTo: { mode: "width", value: 128 } });
const png = resvg.render().asPng();
writeFileSync(OUT, png);

console.log(`rendered ${OUT} (128x128) from ${SRC}`);
