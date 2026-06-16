/*
 * Generates public/icon.png (512x512) without external deps —
 * hand-rolled PNG encoder over an RGBA buffer (zlib is built in).
 * Indigo→violet rounded square with a white sketch stroke.
 */
const zlib = require('zlib');
const fs = require('fs');
const path = require('path');

const S = 512;
const px = Buffer.alloc(S * S * 4);

const lerp = (a, b, t) => a + (b - a) * t;
const inRounded = (x, y, x0, y0, x1, y1, r) => {
  if (x < x0 || x > x1 || y < y0 || y > y1) return false;
  const cx = Math.max(x0 + r, Math.min(x, x1 - r));
  const cy = Math.max(y0 + r, Math.min(y, y1 - r));
  return (x - cx) ** 2 + (y - cy) ** 2 <= r * r || (x >= x0 + r && x <= x1 - r) || (y >= y0 + r && y <= y1 - r);
};

// Sample the swirl path (matches icon.svg) as dense points.
const pts = [];
const bez = (p0, p1, p2, p3, t) => {
  const u = 1 - t;
  return [
    u * u * u * p0[0] + 3 * u * u * t * p1[0] + 3 * u * t * t * p2[0] + t * t * t * p3[0],
    u * u * u * p0[1] + 3 * u * u * t * p1[1] + 3 * u * t * t * p2[1] + t * t * t * p3[1],
  ];
};
const segs = [
  [[150, 330], [150, 230], [240, 150], [330, 166]],
  [[330, 166], [388, 177], [380, 238], [322, 252]],
  [[322, 252], [264, 266], [196, 282], [208, 330]],
  [[208, 330], [218, 370], [296, 366], [344, 330]],
];
for (const s of segs) for (let t = 0; t <= 1; t += 0.002) pts.push(bez(...s, t));

const strokeR = 19;
const distToPath = (x, y) => {
  let d = Infinity;
  for (const [px_, py_] of pts) {
    const dd = (x - px_) ** 2 + (y - py_) ** 2;
    if (dd < d) d = dd;
  }
  return Math.sqrt(d);
};

for (let y = 0; y < S; y++) {
  for (let x = 0; x < S; x++) {
    const i = (y * S + x) * 4;
    if (inRounded(x, y, 32, 32, 480, 480, 112)) {
      const t = (x + y) / (2 * S);
      let r = Math.round(lerp(0x63, 0x8b, t));
      let g = Math.round(lerp(0x66, 0x5c, t));
      let b = Math.round(lerp(0xf1, 0xf6, t));
      const d = distToPath(x, y);
      const dot = Math.sqrt((x - 360) ** 2 + (y - 352) ** 2);
      if (d < strokeR || dot < 26) { r = 255; g = 255; b = 255; }
      else if (d < strokeR + 1.5 || dot < 27.5) {
        const a = Math.min(strokeR + 1.5 - d, 27.5 - dot >= 0 ? 27.5 - dot : 1.5) / 1.5;
        r = Math.round(lerp(r, 255, a)); g = Math.round(lerp(g, 255, a)); b = Math.round(lerp(b, 255, a));
      }
      px[i] = r; px[i + 1] = g; px[i + 2] = b; px[i + 3] = 255;
    } else {
      px[i + 3] = 0;
    }
  }
}

// PNG encode
const crcTable = [];
for (let n = 0; n < 256; n++) {
  let c = n;
  for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  crcTable[n] = c >>> 0;
}
const crc32 = (buf) => {
  let c = 0xffffffff;
  for (const b of buf) c = crcTable[(c ^ b) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
};
const chunk = (type, data) => {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length);
  const td = Buffer.concat([Buffer.from(type), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(td));
  return Buffer.concat([len, td, crc]);
};
const ihdr = Buffer.alloc(13);
ihdr.writeUInt32BE(S, 0); ihdr.writeUInt32BE(S, 4);
ihdr[8] = 8; ihdr[9] = 6; // 8-bit RGBA
const raw = Buffer.alloc(S * (S * 4 + 1));
for (let y = 0; y < S; y++) {
  raw[y * (S * 4 + 1)] = 0;
  px.copy(raw, y * (S * 4 + 1) + 1, y * S * 4, (y + 1) * S * 4);
}
const png = Buffer.concat([
  Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
  chunk('IHDR', ihdr),
  chunk('IDAT', zlib.deflateSync(raw, { level: 9 })),
  chunk('IEND', Buffer.alloc(0)),
]);
const out = path.join(__dirname, '..', 'public', 'icon.png');
fs.writeFileSync(out, png);
console.log('wrote', out, png.length, 'bytes');
