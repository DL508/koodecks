// scripts/make-icons.js
// Generates simple PNG icons (192 and 512) with no dependencies, using Node's
// built-in zlib to write a valid PNG. Draws the KooDeck mark: a violet
// rounded square with a cream "card" and a coral play triangle.
// Run once with:  node scripts/make-icons.js

const fs = require("fs");
const path = require("path");
const zlib = require("zlib");

function crc32(buf) {
  let table = crc32.table;
  if (!table) {
    table = crc32.table = new Int32Array(256);
    for (let n = 0; n < 256; n++) {
      let c = n;
      for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
      table[n] = c;
    }
  }
  let c = 0xffffffff;
  for (let i = 0; i < buf.length; i++) c = table[(c ^ buf[i]) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

function chunk(type, data) {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length);
  const typeBuf = Buffer.from(type, "ascii");
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(Buffer.concat([typeBuf, data])));
  return Buffer.concat([len, typeBuf, data, crc]);
}

function writePng(file, size, pixelFn) {
  const raw = Buffer.alloc(size * (size * 4 + 1));
  for (let y = 0; y < size; y++) {
    raw[y * (size * 4 + 1)] = 0; // filter: none
    for (let x = 0; x < size; x++) {
      const [r, g, b, a] = pixelFn(x, y, size);
      const o = y * (size * 4 + 1) + 1 + x * 4;
      raw[o] = r; raw[o + 1] = g; raw[o + 2] = b; raw[o + 3] = a;
    }
  }
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(size, 0);
  ihdr.writeUInt32BE(size, 4);
  ihdr[8] = 8;  // bit depth
  ihdr[9] = 6;  // color type RGBA
  const png = Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk("IHDR", ihdr),
    chunk("IDAT", zlib.deflateSync(raw)),
    chunk("IEND", Buffer.alloc(0)),
  ]);
  fs.writeFileSync(file, png);
  console.log("wrote", file);
}

// Colors
const VIOLET = [79, 63, 240, 255];
const CREAM = [253, 249, 240, 255];
const CORAL = [255, 93, 115, 255];
const INK = [36, 31, 61, 255];
const CLEAR = [0, 0, 0, 0];

function inRoundedRect(x, y, x0, y0, w, h, r) {
  if (x < x0 || y < y0 || x >= x0 + w || y >= y0 + h) return false;
  const cx = Math.max(x0 + r, Math.min(x, x0 + w - r));
  const cy = Math.max(y0 + r, Math.min(y, y0 + h - r));
  const inCorner =
    (x < x0 + r || x > x0 + w - r) && (y < y0 + r || y > y0 + h - r);
  if (!inCorner) return true;
  const dx = x - cx, dy = y - cy;
  return dx * dx + dy * dy <= r * r;
}

function inTriangle(px, py, ax, ay, bx, by, cx, cy) {
  const d1 = (px - bx) * (ay - by) - (ax - bx) * (py - by);
  const d2 = (px - cx) * (by - cy) - (bx - cx) * (py - cy);
  const d3 = (px - ax) * (cy - ay) - (cx - ax) * (py - ay);
  const neg = d1 < 0 || d2 < 0 || d3 < 0;
  const pos = d1 > 0 || d2 > 0 || d3 > 0;
  return !(neg && pos);
}

function pixel(x, y, size) {
  const u = x / size, v = y / size;
  // Outer rounded square with ink border
  if (!inRoundedRect(u, v, 0.03, 0.03, 0.94, 0.94, 0.24)) return CLEAR;
  if (!inRoundedRect(u, v, 0.065, 0.065, 0.87, 0.87, 0.21)) return INK;
  // Inner cream card
  const inCardBorder = inRoundedRect(u, v, 0.18, 0.25, 0.64, 0.5, 0.12);
  const inCard = inRoundedRect(u, v, 0.205, 0.275, 0.59, 0.45, 0.1);
  // Play triangle
  const inTriBorder = inTriangle(u, v, 0.40, 0.35, 0.40, 0.65, 0.67, 0.5);
  const inTri = inTriangle(u, v, 0.425, 0.385, 0.425, 0.615, 0.635, 0.5);
  if (inTri) return CORAL;
  if (inTriBorder && inCard) return INK;
  if (inCard) return CREAM;
  if (inCardBorder) return INK;
  return VIOLET;
}

const outDir = path.join(__dirname, "..", "public", "icons");
fs.mkdirSync(outDir, { recursive: true });
writePng(path.join(outDir, "icon-192.png"), 192, pixel);
writePng(path.join(outDir, "icon-512.png"), 512, pixel);
