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
console.log('PNG size:', w, 'x', h);

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

// Guard box do context: cols 23-135, rows 116-182
const guardBox = { minRow: 116, maxRow: 182, minCol: 23, maxCol: 135 };
const H = guardBox.maxRow - guardBox.minRow + 1;
const W = guardBox.maxCol - guardBox.minCol + 1;
console.log('Guard box:', W, 'x', H);

// Extract guard sub-image
const grid = [];
for (let y = 0; y < H; y++) {
 const row = [];
 for (let x = 0; x < W; x++) {
  const p = img[guardBox.minRow + y][guardBox.minCol + x];
  row.push({ r: p.r, g: p.g, b: p.b, a: p.a });
 }
 grid.push(row);
}

// Detect pixel art grid: run-length encode rows, find common run lengths
function runLengths(row) {
 const runs = [];
 let current = row[0], count = 1;
 for (let x = 1; x < row.length; x++) {
  if (row[x].r === current.r && row[x].g === current.g && row[x].b === current.b && row[x].a === current.a) {
   count++;
  } else {
   if (current.a > 200) runs.push(count);
   current = row[x];
   count = 1;
  }
 }
 if (current.a > 200) runs.push(count);
 return runs;
}

// Collect all horizontal run lengths for non-transparent pixels
const allRuns = new Set();
for (let y = 0; y < H; y++) {
 for (const r of runLengths(grid[y])) allRuns.add(r);
}
console.log('Unique horizontal run lengths:', [...allRuns].sort((a,b)=>a-b));

// Also scan columns
function colRunLengths(grid, col) {
 const runs = [];
 let current = grid[0][col], count = 1;
 for (let y = 1; y < H; y++) {
  const p = grid[y][col];
  if (p.r === current.r && p.g === current.g && p.b === current.b && p.a === current.a) {
   count++;
  } else {
   if (current.a > 200) runs.push(count);
   current = p;
   count = 1;
  }
 }
 if (current.a > 200) runs.push(count);
 return runs;
}

for (let x = 0; x < W; x++) {
 for (const r of colRunLengths(grid, x)) allRuns.add(r);
}
console.log('Unique run lengths (h+v):', [...allRuns].sort((a,b)=>a-b));

// GCD of all run lengths
function gcd(a, b) { return b === 0 ? a : gcd(b, a % b); }
const runsArr = [...allRuns].filter(x => x > 0);
let g = runsArr[0];
for (let i = 1; i < runsArr.length; i++) g = gcd(g, runsArr[i]);
console.log('GCD of run lengths:', g);

// Reduced grid size
console.log('Reduced grid size (W/g, H/g):', Math.floor(W/g), 'x', Math.floor(H/g));

// Extract reduced grid with unique colors
const reducedGrid = [];
for (let y = 0; y < Math.floor(H/g); y++) {
 const row = [];
 for (let x = 0; x < Math.floor(W/g); x++) {
  // Sample center of cell
  const sy = y * g + Math.floor(g/2);
  const sx = x * g + Math.floor(g/2);
  const p = grid[sy][sx];
  const key = `${p.r},${p.g},${p.b},${p.a}`;
  row.push(key);
 }
 reducedGrid.push(row);
}

// Count unique colors
const colors = new Set();
for (const row of reducedGrid) for (const c of row) colors.add(c);
console.log('Unique colors in reduced grid:', colors.size);

// Show some color samples
console.log('Sample colors (r,g,b,a):');
let count = 0;
for (const c of colors) {
 if (count++ < 10) console.log(' ', c);
}
