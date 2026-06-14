// math.js — small, dependency-free math + RNG + color utilities.
// Everything here is pure; the rest of the sim leans on it heavily.

export const TAU = Math.PI * 2;

export const clamp = (x, lo, hi) => (x < lo ? lo : x > hi ? hi : x);
export const lerp = (a, b, t) => a + (b - a) * t;
export const map = (x, a, b, c, d) => c + ((x - a) * (d - c)) / (b - a);
export const smoothstep = (t) => t * t * (3 - 2 * t);

// Wrap an angle to (-PI, PI].
export function angleWrap(a) {
  a = (a + Math.PI) % TAU;
  if (a < 0) a += TAU;
  return a - Math.PI;
}
// Signed smallest difference b - a, wrapped.
export const angleDiff = (a, b) => angleWrap(b - a);

// A small, fast, seedable PRNG (mulberry32). Deterministic worlds from a seed.
export class RNG {
  constructor(seed = 1) {
    this.s = (seed >>> 0) || 1;
  }
  next() {
    // mulberry32
    let t = (this.s += 0x6d2b79f5);
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  }
  range(a, b) { return a + (b - a) * this.next(); }
  int(n) { return Math.floor(this.next() * n); }
  bool(p = 0.5) { return this.next() < p; }
  pick(arr) { return arr[this.int(arr.length)]; }
  sign() { return this.next() < 0.5 ? -1 : 1; }
  // Box–Muller normal.
  gauss(mean = 0, std = 1) {
    let u = 0, v = 0;
    while (u === 0) u = this.next();
    while (v === 0) v = this.next();
    return mean + std * Math.sqrt(-2 * Math.log(u)) * Math.cos(TAU * v);
  }
}

// HSL (h in [0,360], s,l in [0,1]) -> "rgb(...)" string. Cached-friendly enough.
export function hsl(h, s, l, a = 1) {
  return `hsla(${h.toFixed(0)}, ${(s * 100).toFixed(0)}%, ${(l * 100).toFixed(0)}%, ${a})`;
}

// Convert hue (0..360) to an [r,g,b] 0..255 triple at full sat/val — for fast pixel work if needed.
export function hueToRgb(h, s = 0.7, l = 0.55) {
  const c = (1 - Math.abs(2 * l - 1)) * s;
  const hp = h / 60;
  const x = c * (1 - Math.abs((hp % 2) - 1));
  let r = 0, g = 0, b = 0;
  if (hp < 1) [r, g, b] = [c, x, 0];
  else if (hp < 2) [r, g, b] = [x, c, 0];
  else if (hp < 3) [r, g, b] = [0, c, x];
  else if (hp < 4) [r, g, b] = [0, x, c];
  else if (hp < 5) [r, g, b] = [x, 0, c];
  else [r, g, b] = [c, 0, x];
  const m = l - c / 2;
  return [Math.round((r + m) * 255), Math.round((g + m) * 255), Math.round((b + m) * 255)];
}

// Format a large integer with thin separators, e.g. 12_300 -> "12,300".
export function fmt(n) {
  return Math.round(n).toLocaleString("en-US");
}
