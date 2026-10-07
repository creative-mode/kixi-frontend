/* eslint-disable @typescript-eslint/no-require-imports */
const zlib = require('zlib');
const fs = require('fs');

const buf = fs.readFileSync('landing/public/guard-source.png.png');
const sig = Buffer.from([0x89,0x50,0x4e,0x47,0x0d,0x0a,0x1a,0x0a]);
if (!buf.slice(0,8).equals(sig)) throw new Error('Not PNG');

let idx = 8;
const chunks = [];
while (idx < buf.length) {
 const len = buf.readUInt32BE(idx);
 const type = buf.toString('ascii', idx+4, idx+8);
 const data = buf.slice(idx+8, idx+8+len);
 chunks.push({type, data});
 idx += 12 + len;
 if (type === 'IEND') break;
}
const ihdr = chunks.find(c => c.type === 'IHDR');
const w = ihdr.data.readUInt32BE(0);
const h = ihdr.data.readUInt32BE(4);
const idat = chunks.filter(c => c.type === 'IDAT');
const pixels = zlib.inflateSync(Buffer.concat(idat.map(c => c.data)), { windowBits: 15 });
const img = [];
for (let y = 0; y < h; y++) {
 const row = [];
 for (let x = 0; x < w; x++) {
  const i = y * (w * 4 + 1) + 1 + x * 4;
  row.push({ r: pixels[i], g: pixels[i+1], b: pixels[i+2], a: pixels[i+3] });
 }
 img.push(row);
}

// Guard box: cols 23-135, rows 116-182
const guardBox = { minRow: 116, maxRow: 182, minCol: 23, maxCol: 135 };
const H = guardBox.maxRow - guardBox.minRow + 1;
const W = guardBox.maxCol - guardBox.minCol + 1;

const grid = [];
for (let y = 0; y < H; y++) {
 const row = [];
 for (let x = 0; x < W; x++) {
  const p = img[guardBox.minRow + y][guardBox.minCol + x];
  row.push({ r: p.r, g: p.g, b: p.b, a: p.a });
 }
 grid.push(row);
}

// Build map: colorKey -> [{x,y}] for all pixels of that color
const colorPixels = new Map();
for (let y = 0; y < H; y++) {
 for (let x = 0; x < W; x++) {
  const p = grid[y][x];
  if (p.a < 200) continue; // skip transparent
  const key = `${p.r},${p.g},${p.b},${p.a}`;
  if (!colorPixels.has(key)) colorPixels.set(key, []);
  colorPixels.get(key).push({x, y});
 }
}

// Generate path d for each color: horizontal runs joined
function pathOfPixels(pixels) {
 // Group by row, then sort by x
 const byRow = new Map();
 for (const p of pixels) {
  if (!byRow.has(p.y)) byRow.set(p.y, []);
  byRow.get(p.y).push(p.x);
 }
 let d = '';
 for (const [y, xs] of byRow) {
  xs.sort((a,b) => a-b);
  // Merge consecutive runs
  let i = 0;
  while (i < xs.length) {
   const start = xs[i];
   let len = 1;
   while (i + len < xs.length && xs[i+len] === start + len) len++;
   d += ` M${start} ${y}h${len}v1h-${len}z`;
   i += len;
  }
 }
 return d.trim();
}

// Generate palette: { color, d } sorted by color
const palette = [];
for (const [colorKey, pixels] of colorPixels) {
 palette.push({ color: colorKey, d: pathOfPixels(pixels) });
}
palette.sort((a, b) => a.color.localeCompare(b.color));

// Output TypeScript file
let out = `/** Auto-generated guard sprite from PNG */\n\nexport const GUARD_COLS = ${W};\nexport const GUARD_ROWS = ${H};\n\nexport const guardSprites = [\n`;
for (const { color, d } of palette) {
 const [r, g, b, a] = color.split(',').map(Number);
 const hex = '#' + [r,g,b].map(n => n.toString(16).padStart(2,'0')).join('');
 out += `  { color: '${color}', hex: '${hex}', alpha: ${a}, d: \`\n${d}\n  \` },\n`;
}
out += `];\n`;

fs.writeFileSync('landing/components/forbidden/guard-sprite.ts', out);
console.log('Generated guard-sprite.ts with', palette.length, 'colors');
