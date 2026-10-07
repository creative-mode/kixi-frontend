/* eslint-disable @typescript-eslint/no-require-imports */
// Corredores a partir da location deste ficheiro, para o script correr de qualquer sítio.
const path = require('path');
const LANDING = path.resolve(__dirname, '..', '..');
const zlib = require('zlib');
const fs = require('fs');

function readChunk(buf, idx) {
  const len = buf.readUInt32BE(idx);
  const type = buf.toString('ascii', idx+4, idx+8);
  const data = buf.slice(idx+8, idx+8+len);
  const crc = buf.readUInt32BE(idx+8+len);
  return { len, type, data, crc, next: idx+12+len };
}

function parsePNG(filepath) {
  const buf = fs.readFileSync(filepath);
  if (buf.slice(0,8).toString() !== '\x89PNG\r\n\x1a\n') throw new Error('Not PNG');
  
  let idx = 8;
  const chunks = [];
  while (idx < buf.length) {
    const c = readChunk(buf, idx);
    chunks.push(c);
    if (c.type === 'IEND') break;
    idx = c.next;
  }
  
  const ihdr = chunks.find(c => c.type === 'IHDR');
  const w = ihdr.data.readUInt32BE(0);
  const h = ihdr.data.readUInt32BE(4);
  
  const idat = chunks.filter(c => c.type === 'IDAT');
  const idatRaw = Buffer.concat(idat.map(c => c.data));
  const pixels = zlib.inflateSync(idatRaw, { windowBits: 15 });
  
  const img = [];
  const stride = w * 4 + 1;
  for (let y = 0; y < h; y++) {
    const row = [];
    const offset = y * stride;
    const filter = pixels[offset];
    for (let x = 0; x < w; x++) {
      const i = offset + 1 + x * 4;
      const [r, g, b, a] = [pixels[i], pixels[i+1], pixels[i+2], pixels[i+3]];
      row.push({ r, g, b, a });
    }
    img.push(row);
  }
  return { w, h, img };
}

function findGuardBox(img, h) {
  let minRow = h, maxRow = 0, minCol = 160, maxCol = 0;
  for (let y = 0; y < h; y++) {
    let rowHasContent = false;
    for (let x = 0; x < 160; x++) {
      if (img[y][x].a > 200) {
        rowHasContent = true;
        minCol = Math.min(minCol, x);
        maxCol = Math.max(maxCol, x);
      }
    }
    if (rowHasContent) {
      minRow = Math.min(minRow, y);
      maxRow = Math.max(maxRow, y);
    }
  }
  return { minRow, maxRow, minCol, maxCol };
}

function pixelToChar(p) {
  const gray = Math.round((p.r + p.g + p.b) / 3);
  if (gray < 40 && p.a > 200) return '#';
  if (gray >= 80 && gray < 120) return 'o';
  if (gray >= 120 && gray < 180) return 'e';
  if (gray >= 180 && p.a > 200) return 'b';
  if (p.a < 50) return 'K';
  return ' ';
}

function buildGuardGrid(img, box) {
  const { minRow, maxRow, minCol, maxCol } = box;
  const rows = maxRow - minRow + 1;
  const cols = maxCol - minCol + 1;
  const grid = Array.from({ length: rows }, () => Array(cols).fill(' '));
  for (let y = 0; y < rows; y++) {
    for (let x = 0; x < cols; x++) {
      const p = img[minRow + y][minCol + x];
      grid[y][x] = pixelToChar(p);
    }
  }
  return grid;
}

function pathOf(grid, keep) {
  let d = '';
  for (let y = 0; y < grid.length; y++) {
    const line = grid[y].join('');
    const re = new RegExp('[' + keep + ']+', 'g');
    for (const m of line.matchAll(re)) {
      d += `M${m.index} ${y}h${m[0].length}v1h-${m[0].length}z`;
    }
  }
  return d;
}

const { w, h, img } = parsePNG('public/guard-source.png.png');
const box = findGuardBox(img, h);
console.error('Guard box: (' + box.minCol + ', ' + box.minRow + ') to (' + box.maxCol + ', ' + box.maxRow + ')');
console.error('Size: ' + (box.maxCol - box.minCol + 1) + ' x ' + (box.maxRow - box.minRow + 1));

const grid = buildGuardGrid(img, box);
const GUARD_COLS = grid[0].length;
const GUARD_ROWS = grid.length;

console.error('Grid sample (first 5 rows):');
for (let i = 0; i < Math.min(5, grid.length); i++) {
  console.error('  ' + grid[i].join(''));
}

const GUARD_BODY = pathOf(grid, '#');
const GUARD_VOID = pathOf(grid, 'K');
const GUARD_RIM = pathOf(grid, 'b');
const GUARD_WHITE = pathOf(grid, 'o');
const GUARD_DIVIDER = pathOf(grid, 'e');
const GUARD_FEET = pathOf(grid, 'f');

console.log('const GUARD_COLS = ' + GUARD_COLS + ';');
console.log('const GUARD_ROWS = ' + GUARD_ROWS + ';');
console.log('');
console.log('const GUARD_BODY = "' + GUARD_BODY.replace(/M/g, '\n      M') + '";');
console.log('const GUARD_VOID = "' + GUARD_VOID.replace(/M/g, '\n      M') + '";');
console.log('const GUARD_RIM = "' + GUARD_RIM.replace(/M/g, '\n      M') + '";');
console.log('const GUARD_WHITE = "' + GUARD_WHITE.replace(/M/g, '\n      M') + '";');
console.log('const GUARD_DIVIDER = "' + GUARD_DIVIDER.replace(/M/g, '\n      M') + '";');
console.log('const GUARD_FEET = "' + GUARD_FEET.replace(/M/g, '\n      M') + '";');
