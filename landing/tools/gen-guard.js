const zlib = require('zlib');
const fs = require('fs');

const buf = fs.readFileSync('public/guard-source.png.png');
const sig = Buffer.from([0x89,0x50,0x4e,0x47,0x0d,0x0a,0x1a,0x0a]);
if (!buf.slice(0,8).equals(sig)) throw new Error('Not PNG');

let idx = 8;
const chunks = [];
while (idx < buf.length) {
 const len = buf.readUInt32BE(idx);
 const type = buf.toString('ascii', idx+4, idx+8);
 const data = buf.slice(idx+8, idx+8+len);
 const crc = buf.readUInt32BE(idx+8+len);
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

const guardBox = { minRow: 116, maxRow: 182, minCol: 23, maxCol: 135 };
const H = guardBox.maxRow - guardBox.minRow + 1;
const W = guardBox.maxCol - guardBox.minCol + 1;
const grid = [];
for (let y = 0; y < H; y++) {
 const row = [];
 for (let x = 0; x < W; x++) {
  const p = img[guardBox.minRow + y][guardBox.minCol + x];
  const gray = Math.round((p.r + p.g + p.b) / 3);
  let ch = ' ';
  if (p.a > 200) {
   if (gray < 40) ch = '#';
   else if (gray < 120) ch = 'o';
   else if (gray < 180) ch = 'e';
   else ch = 'b';
  } else if (p.a > 0) ch = 'K';
  row.push(ch);
 }
 grid.push(row);
}

function pathOf(grid, keep) {
 let d = '';
 for (let y = 0; y < grid.length; y++) {
  const line = grid[y].join('');
  const re = new RegExp('[' + keep + ']+', 'g');
  for (const m of line.matchAll(re)) {
   d += 'M' + m.index + ' ' + y + 'h' + m[0].length + 'v1h-' + m[0].length + 'z';
  }
 }
 return d;
}

const GUARD_BODY = pathOf(grid, '#');
const GUARD_VOID = pathOf(grid, 'K');
const GUARD_RIM = pathOf(grid, 'b');
const GUARD_WHITE = pathOf(grid, 'o');
const GUARD_DIVIDER = pathOf(grid, 'e');
const GUARD_FEET = pathOf(grid, 'f');

console.log('GUARD_COLS = ' + W + ';');
console.log('GUARD_ROWS = ' + H + ';');
console.log('');
console.log('const GUARD_BODY = "' + GUARD_BODY.replace(/M/g, '\n      M') + '";');
console.log('const GUARD_VOID = "' + GUARD_VOID.replace(/M/g, '\n      M') + '";');
console.log('const GUARD_RIM = "' + GUARD_RIM.replace(/M/g, '\n      M') + '";');
console.log('const GUARD_WHITE = "' + GUARD_WHITE.replace(/M/g, '\n      M') + '";');
console.log('const GUARD_DIVIDER = "' + GUARD_DIVIDER.replace(/M/g, '\n      M') + '";');
console.log('const GUARD_FEET = "' + GUARD_FEET.replace(/M/g, '\n      M') + '";');