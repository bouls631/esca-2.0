// Génère les icônes PWA (PNG RGBA) sans dépendance externe : triangle "7a" sur fond sombre.
// Usage : npm run icons  (avant build, si public/icons/*.png absents)
import { deflateSync } from 'node:zlib';
import { mkdirSync, writeFileSync } from 'node:fs';

const crcTable = (() => {
  const t = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    t[n] = c >>> 0;
  }
  return t;
})();

function crc32(buf) {
  let c = ~0;
  for (const b of buf) c = crcTable[(c ^ b) & 0xff] ^ (c >>> 8);
  return (~c) >>> 0;
}

function chunk(type, data) {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length);
  const t = Buffer.from(type, 'latin1');
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(Buffer.concat([t, data])));
  return Buffer.concat([len, t, data, crc]);
}

function encodePng(w, h, px) {
  const raw = Buffer.alloc((w * 4 + 1) * h);
  let p = 0;
  for (let y = 0; y < h; y++) {
    raw[p++] = 0; // filtre "none"
    for (let x = 0; x < w; x++) {
      const c = px(x, y);
      raw[p++] = c[0]; raw[p++] = c[1]; raw[p++] = c[2]; raw[p++] = c[3];
    }
  }
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(w, 0);
  ihdr.writeUInt32BE(h, 4);
  ihdr[8] = 8;  // bit depth
  ihdr[9] = 6;  // RGBA
  return Buffer.concat([
    Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
    chunk('IHDR', ihdr),
    chunk('IDAT', deflateSync(raw, { level: 9 })),
    chunk('IEND', Buffer.alloc(0)),
  ]);
}

const hex = (s) => [parseInt(s.slice(1, 3), 16), parseInt(s.slice(3, 5), 16), parseInt(s.slice(5, 7), 16), 255];
const BG = hex('#0b0e11');
const GREEN = hex('#4ade80');
const DARKGREEN = hex('#14532d');
const AMBER = hex('#f59e0b');

/** Triangle + lune ; `maskScale` réduit la zone utile pour l'icône maskable. */
function draw(size, maskScale = 1) {
  const inset = (1 - maskScale) / 2;
  const map = (x, y) => [x / (size - 1), y / (size - 1)];
  const Ax = 0.5 * maskScale + inset, Ay = 0.16 * maskScale + inset;
  const Bx = 0.14 * maskScale + inset, By = 0.84 * maskScale + inset;
  const Cx = 0.86 * maskScale + inset, Cy = 0.84 * maskScale + inset;
  const sign = (p, a, b) => (p[0] - b[0]) * (a[1] - b[1]) - (a[0] - b[0]) * (p[1] - b[1]);
  const insideTri = (u, v) => {
    const d1 = sign([u, v], [Ax, Ay], [Bx, By]);
    const d2 = sign([u, v], [Bx, By], [Cx, Cy]);
    const d3 = sign([u, v], [Cx, Cy], [Ax, Ay]);
    const neg = d1 < 0 || d2 < 0 || d3 < 0;
    const pos = d1 > 0 || d2 > 0 || d3 > 0;
    return !(neg && pos);
  };
  return (x, y) => {
    const [u, v] = map(x, y);
    if (insideTri(u, v)) {
      // face gauche plus sombre pour le relief
      const slope = (u - Ax) / (Bx - Ax) < (u - Ax) / (Cx - Ax);
      return slope ? DARKGREEN : GREEN;
    }
    // lune ambre en haut à droite
    const mx = 0.74 * maskScale + inset, my = 0.24 * maskScale + inset, mr = 0.055 * maskScale;
    if ((u - mx) ** 2 + (v - my) ** 2 < mr ** 2) return AMBER;
    return BG;
  };
}

mkdirSync('public/icons', { recursive: true });
for (const [name, size, mask] of [
  ['icon-192.png', 192, 1],
  ['icon-512.png', 512, 1],
  ['maskable-192.png', 192, 0.82],
  ['maskable-512.png', 512, 0.82],
]) {
  writeFileSync(`public/icons/${name}`, encodePng(size, size, draw(size, mask)));
  console.log('→ public/icons/' + name);
}
