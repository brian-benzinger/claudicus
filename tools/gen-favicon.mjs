// Generates favicon.png (32x32) — a pixel-art rendering of the player's head,
// matching the in-game palette from src/renderer.ts. Zero dependencies: Node's
// built-in zlib does the PNG compression. Also emits a scaled preview PNG.
//
//   node tools/gen-favicon.mjs
import { deflateSync } from 'node:zlib';
import { writeFileSync } from 'node:fs';

// ---- palette (from src/renderer.ts COLORS) ----
const C = {
  bg:       [0x1a, 0x1a, 0x2e, 255],
  body:     [0x4a, 0x37, 0x28, 255], // leather
  bodyEdge: [0x2a, 0x1f, 0x14, 255],
  neck:     [0xc8, 0x99, 0x5f, 255],
  hair:     [0x2a, 0x1f, 0x14, 255],
  skin:     [0xd4, 0xa5, 0x74, 255],
  eye:      [0x1a, 0x12, 0x18, 255],
  mouth:    [0xa8, 0x7f, 0x57, 255],
};

const W = 32, H = 32;
const buf = new Uint8Array(W * H * 4);
const set = (x, y, c) => {
  if (x < 0 || x >= W || y < 0 || y >= H) return;
  const i = (y * W + x) * 4;
  buf[i] = c[0]; buf[i + 1] = c[1]; buf[i + 2] = c[2]; buf[i + 3] = c[3];
};
const inCircle = (x, y, cx, cy, r) => (x + 0.5 - cx) ** 2 + (y + 0.5 - cy) ** 2 <= r * r;

for (let y = 0; y < H; y++) {
  for (let x = 0; x < W; x++) {
    let c = C.bg;
    // rounded corners stay background
    const corner = (cx, cy) => (x + 0.5 - cx) ** 2 + (y + 0.5 - cy) ** 2 > 7 * 7;
    const roundedOut =
      (x < 7 && y < 7 && corner(7, 7)) ||
      (x > 24 && y < 7 && corner(25, 7)) ||
      (x < 7 && y > 24 && corner(7, 25)) ||
      (x > 24 && y > 24 && corner(25, 25));
    if (roundedOut) { set(x, y, C.bg); continue; }

    // shoulders (leather) — trapezoid in lower portion
    if (y >= 24) {
      const spread = (y - 24) * 1.6;
      if (x >= 11 - spread && x <= 21 + spread) c = C.body;
    }
    // neck
    if (x >= 14 && x <= 18 && y >= 21 && y <= 25) c = C.neck;
    // hair (behind / framing the head)
    if (inCircle(x, y, 16, 13, 9.6)) c = C.hair;
    // face
    if (inCircle(x, y, 16, 15, 8)) c = C.skin;
    // fringe sweeping over the forehead
    if (inCircle(x, y, 16, 15, 8) && y <= 11) c = C.hair;
    // eyes
    if (y >= 15 && y <= 17 && ((x >= 12 && x <= 13) || (x >= 18 && x <= 19))) c = C.eye;
    // mouth
    if (y === 20 && x >= 14 && x <= 17) c = C.mouth;

    set(x, y, c);
  }
}

// ---- PNG encoding ----
const CRC = (() => {
  const t = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    t[n] = c >>> 0;
  }
  return (b) => {
    let c = 0xffffffff;
    for (let i = 0; i < b.length; i++) c = t[(c ^ b[i]) & 0xff] ^ (c >>> 8);
    return (c ^ 0xffffffff) >>> 0;
  };
})();

function chunk(type, data) {
  const t = Buffer.from(type, 'ascii');
  const len = Buffer.alloc(4); len.writeUInt32BE(data.length, 0);
  const body = Buffer.concat([t, data]);
  const crc = Buffer.alloc(4); crc.writeUInt32BE(CRC(body), 0);
  return Buffer.concat([len, body, crc]);
}

function encodePNG(width, height, rgba) {
  const sig = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0); ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8; ihdr[9] = 6; // 8-bit, RGBA
  const raw = Buffer.alloc((width * 4 + 1) * height);
  for (let y = 0; y < height; y++) {
    raw[y * (width * 4 + 1)] = 0; // filter: none
    rgba.copy
      ? rgba.copy(raw, y * (width * 4 + 1) + 1, y * width * 4, (y + 1) * width * 4)
      : Buffer.from(rgba.subarray(y * width * 4, (y + 1) * width * 4))
          .copy(raw, y * (width * 4 + 1) + 1);
  }
  const idat = deflateSync(raw, { level: 9 });
  return Buffer.concat([sig, chunk('IHDR', ihdr), chunk('IDAT', idat), chunk('IEND', Buffer.alloc(0))]);
}

// nearest-neighbour upscale for a crisp preview
function scale(rgba, w, h, factor) {
  const W2 = w * factor, H2 = h * factor;
  const out = Buffer.alloc(W2 * H2 * 4);
  for (let y = 0; y < H2; y++)
    for (let x = 0; x < W2; x++) {
      const si = ((y / factor | 0) * w + (x / factor | 0)) * 4;
      const di = (y * W2 + x) * 4;
      out[di] = rgba[si]; out[di + 1] = rgba[si + 1]; out[di + 2] = rgba[si + 2]; out[di + 3] = rgba[si + 3];
    }
  return { buf: out, w: W2, h: H2 };
}

const rgba = Buffer.from(buf);
writeFileSync('favicon.png', encodePNG(W, H, rgba));
const big = scale(rgba, W, H, 8);
writeFileSync(process.env.PREVIEW || '/tmp/favicon-preview.png', encodePNG(big.w, big.h, big.buf));
console.log('Wrote favicon.png (32x32) and preview (256x256)');
